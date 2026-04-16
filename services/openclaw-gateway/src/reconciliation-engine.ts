/**
 * Reconciliation Engine — C-1d Accountant ↔ Finance 自動對帳
 *
 * ◆ 設計等級：CRITICAL（確保帳本 ↔ 貸款記錄完全一致）
 *
 * 核心邏輯：
 *   1. 從 Accountant 帳本抓取所有 loan-related 費用（category 含 loan/mortgage）
 *   2. 從 Finance 貸款庫抓取所有 active loan 的月繳金額
 *   3. 雙向比對，產生 ReconciliationReport
 *
 * 對帳規則引擎（Opus 設計決策）：
 *
 *   Rule 1: MATCH — 帳本中有一筆支出，金額與某貸款的月繳相符（±NT$100 容差）
 *   Rule 2: AMOUNT_MISMATCH — 銀行名稱匹配但金額不一致（可能利率調整/提前還款）
 *   Rule 3: MISSING_LEDGER — 貸款庫有 active 貸款但帳本沒有對應月繳支出
 *   Rule 4: MISSING_LOAN — 帳本有 loan 類支出但找不到對應的貸款記錄
 *
 * 使用方式：
 *   GET  /system/reconcile?period=202604 — 指定期間對帳
 *   POST /system/reconcile              — 手動觸發全量對帳
 *
 * @module ReconciliationEngine
 * @since v8.0
 */

import { logger } from './logger';
import type {
  ReconciliationStatus,
  ReconciliationItem,
  ReconciliationReport,
} from '@xxt-agent/types';
import type { EntityType } from './entity';

// ════════════════════════════════════════════════════════════════
// 常數
// ════════════════════════════════════════════════════════════════

/** 金額容差（NT$）— 允許四捨五入差異 */
const AMOUNT_TOLERANCE = 100;

/** Gateway 內部 URL */
const GATEWAY_BASE = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3100';

/** 認證 Token */
const AUTH_HEADER = { 'Authorization': `Bearer ${process.env['OPENCLAW_API_KEY'] ?? 'dev-secret-key'}` };

// ════════════════════════════════════════════════════════════════
// 內部型別
// ════════════════════════════════════════════════════════════════

interface LedgerLoanItem {
  entry_id: string;
  description: string;
  amount: number;
  entity_type: EntityType;
  bank_hint: string;       // 從 description 或 counterparty 解析出的銀行名
  transaction_date: string;
}

interface ActiveLoanItem {
  loan_id: string;
  bank: string;
  category: string;
  entity_type: EntityType;
  monthly_payment: number;
  loan_name?: string;
}

// ════════════════════════════════════════════════════════════════
// 資料擷取
// ════════════════════════════════════════════════════════════════

/**
 * 從 Accountant 帳本取得 loan-related 支出。
 *
 * 掃描 category 包含以下關鍵字的 expense：
 *   - loan_interest, mortgage, other_expense（含「貸」「月繳」描述者）
 */
async function fetchLedgerLoanEntries(period?: string): Promise<LedgerLoanItem[]> {
  try {
    const params = new URLSearchParams({ type: 'expense', limit: '500' });
    if (period) params.append('period', period);

    const resp = await fetch(
      `${GATEWAY_BASE}/agents/accountant/ledger?${params}`,
      { headers: AUTH_HEADER, signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return [];

    const data = await resp.json() as {
      entries: Array<{
        entry_id: string;
        description: string;
        amount_taxed: number;
        entity_type: EntityType;
        counterparty_name?: string;
        category: string;
        transaction_date: string;
      }>;
    };

    // 篩選 loan-related entries
    const loanKeywords = ['貸款', '月繳', 'loan', 'mortgage', '房貸', '車貸', '信貸'];
    const loanCategories = ['loan_interest', 'mortgage', 'other_expense'];

    return (data.entries ?? [])
      .filter(e => {
        const isLoanCategory = loanCategories.some(c => e.category.includes(c));
        const isLoanDesc = loanKeywords.some(k =>
          e.description.toLowerCase().includes(k) ||
          (e.counterparty_name ?? '').toLowerCase().includes(k)
        );
        return isLoanCategory || isLoanDesc;
      })
      .map(e => ({
        entry_id: e.entry_id,
        description: e.description,
        amount: e.amount_taxed,
        entity_type: e.entity_type,
        bank_hint: extractBankName(e.description, e.counterparty_name),
        transaction_date: e.transaction_date,
      }));
  } catch (err) {
    logger.warn(`[Reconcile] Failed to fetch ledger entries: ${err}`);
    return [];
  }
}

/**
 * 從 Finance 貸款庫取得所有 active 貸款。
 */
async function fetchActiveLoans(entityType?: EntityType): Promise<ActiveLoanItem[]> {
  try {
    const params = new URLSearchParams({ status: 'active', limit: '200' });
    if (entityType) params.append('entity_type', entityType);

    const resp = await fetch(
      `${GATEWAY_BASE}/agents/finance/loan?${params}`,
      { headers: AUTH_HEADER, signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return [];

    const data = await resp.json() as {
      loans: Array<{
        loan_id: string;
        bank: string;
        category: string;
        entity_type: EntityType;
        monthly_payment: number;
        loan_name?: string;
      }>;
    };

    return (data.loans ?? []).map(l => ({
      loan_id: l.loan_id,
      bank: l.bank,
      category: l.category,
      entity_type: l.entity_type,
      monthly_payment: l.monthly_payment,
      loan_name: l.loan_name,
    }));
  } catch (err) {
    logger.warn(`[Reconcile] Failed to fetch active loans: ${err}`);
    return [];
  }
}

// ════════════════════════════════════════════════════════════════
// 工具函數
// ════════════════════════════════════════════════════════════════

/**
 * 從描述/對手方名稱中嘗試解析銀行名。
 *
 * 常見格式：
 *   - "土地銀行月繳" → "土地銀行"
 *   - "玉山房貸 2024-08" → "玉山"
 *   - "第一銀行信貸月付" → "第一銀行"
 */
const BANK_KEYWORDS = [
  '土地銀行', '土銀', '玉山', '第一銀行', '一銀', '華南',
  '彰化銀行', '彰銀', '兆豐', '合作金庫', '合庫', '中國信託',
  '中信', '國泰世華', '國泰', '台北富邦', '富邦', '永豐',
  '元大', '台新', '新光', '花旗', '匯豐', '星展', '渣打',
  '台灣銀行', '台銀', '農會', '信用合作社',
];

function extractBankName(description: string, counterparty?: string): string {
  const combined = `${description} ${counterparty ?? ''}`;
  for (const bank of BANK_KEYWORDS) {
    if (combined.includes(bank)) return bank;
  }
  return '未識別';
}

/**
 * 規範化銀行名稱以便比對（去除空格、轉小寫、統一簡稱）。
 */
function normalizeBankName(name: string): string {
  const aliases: Record<string, string> = {
    '土銀': '土地銀行',
    '一銀': '第一銀行',
    '彰銀': '彰化銀行',
    '合庫': '合作金庫',
    '中信': '中國信託',
    '國泰': '國泰世華',
    '台銀': '台灣銀行',
  };
  const trimmed = name.replace(/\s/g, '');
  return aliases[trimmed] ?? trimmed;
}

// ════════════════════════════════════════════════════════════════
// 核心對帳引擎
// ════════════════════════════════════════════════════════════════

/**
 * 執行雙向對帳。
 *
 * 1. 以貸款庫為主軸，逐筆檢查是否有對應的帳本支出
 * 2. 以帳本為主軸，檢查是否有孤立的 loan 類支出
 * 3. 彙整成 ReconciliationReport
 */
export async function performReconciliation(
  period?: string,
  entityType?: EntityType,
): Promise<ReconciliationReport> {
  const startTime = Date.now();

  // 並行擷取兩端資料
  const [ledgerEntries, activeLoans] = await Promise.all([
    fetchLedgerLoanEntries(period),
    fetchActiveLoans(entityType),
  ]);

  const items: ReconciliationItem[] = [];
  const matchedLedgerIds = new Set<string>();

  // ── Pass 1: 以貸款庫為主軸（確保每筆貸款都有對應帳本記錄）──
  for (const loan of activeLoans) {
    const normalizedLoanBank = normalizeBankName(loan.bank);

    // 找帳本中匹配的 entry（同銀行 + 同實體）
    const candidates = ledgerEntries.filter(e => {
      const normalizedEntryBank = normalizeBankName(e.bank_hint);
      return normalizedEntryBank === normalizedLoanBank
        && e.entity_type === loan.entity_type;
    });

    if (candidates.length === 0) {
      // Rule 3: MISSING_LEDGER
      items.push({
        match_key: `${loan.bank}-${loan.category}`,
        status: 'MISSING_LEDGER' as ReconciliationStatus,
        loan_amount: loan.monthly_payment,
        delta: loan.monthly_payment,
        loan_id: loan.loan_id,
        description: `貸款「${loan.loan_name ?? loan.category}」(${loan.bank}) 月繳 NT$${loan.monthly_payment.toLocaleString()}，帳本未記錄`,
      });
    } else {
      // 找最接近金額的 candidate
      const bestMatch = candidates.reduce((best, cur) => {
        const bestDiff = Math.abs(best.amount - loan.monthly_payment);
        const curDiff  = Math.abs(cur.amount - loan.monthly_payment);
        return curDiff < bestDiff ? cur : best;
      });

      const delta = Math.abs(bestMatch.amount - loan.monthly_payment);

      if (delta <= AMOUNT_TOLERANCE) {
        // Rule 1: MATCHED
        items.push({
          match_key: `${loan.bank}-${loan.category}`,
          status: 'MATCHED' as ReconciliationStatus,
          ledger_amount: bestMatch.amount,
          loan_amount: loan.monthly_payment,
          delta: 0,
          ledger_entry_id: bestMatch.entry_id,
          loan_id: loan.loan_id,
          description: `✅ ${loan.bank} ${loan.loan_name ?? loan.category} 帳本/貸款吻合`,
        });
      } else {
        // Rule 2: AMOUNT_MISMATCH
        items.push({
          match_key: `${loan.bank}-${loan.category}`,
          status: 'AMOUNT_MISMATCH' as ReconciliationStatus,
          ledger_amount: bestMatch.amount,
          loan_amount: loan.monthly_payment,
          delta,
          ledger_entry_id: bestMatch.entry_id,
          loan_id: loan.loan_id,
          description: `⚠️ ${loan.bank} 金額差異 NT$${delta.toLocaleString()}（帳本 ${bestMatch.amount.toLocaleString()} vs 貸款 ${loan.monthly_payment.toLocaleString()}）`,
        });
      }

      matchedLedgerIds.add(bestMatch.entry_id);
    }
  }

  // ── Pass 2: 以帳本為主軸（找出孤立的 loan 類支出）──
  for (const entry of ledgerEntries) {
    if (matchedLedgerIds.has(entry.entry_id)) continue;

    // Rule 4: MISSING_LOAN
    items.push({
      match_key: `ledger-${entry.bank_hint}`,
      status: 'MISSING_LOAN' as ReconciliationStatus,
      ledger_amount: entry.amount,
      delta: entry.amount,
      ledger_entry_id: entry.entry_id,
      description: `帳本有 loan 類支出 NT$${entry.amount.toLocaleString()} (${entry.description})，但貸款庫無對應記錄`,
    });
  }

  // ── 統計 ──
  const ledgerTotal = ledgerEntries.reduce((sum, e) => sum + e.amount, 0);
  const loanTotal = activeLoans.reduce((sum, l) => sum + l.monthly_payment, 0);
  const totalDelta = Math.abs(ledgerTotal - loanTotal);
  const hasDiscrepancy = items.some(i =>
    i.status === 'MISSING_LEDGER' || i.status === 'MISSING_LOAN' || i.status === 'AMOUNT_MISMATCH'
  );

  // ── 行動建議 ──
  const actionItems: ReconciliationReport['action_items'] = [];

  const missingLedger = items.filter(i => i.status === 'MISSING_LEDGER');
  if (missingLedger.length > 0) {
    actionItems.push({
      priority: 'CRITICAL',
      action: `${missingLedger.length} 筆貸款月繳未記入帳本，請立即補錄：${missingLedger.map(i => i.match_key).join(', ')}`,
    });
  }

  const missingLoan = items.filter(i => i.status === 'MISSING_LOAN');
  if (missingLoan.length > 0) {
    actionItems.push({
      priority: 'HIGH',
      action: `${missingLoan.length} 筆帳本 loan 支出無對應貸款記錄，請至 /fin loan add 補建`,
    });
  }

  const amountMismatch = items.filter(i => i.status === 'AMOUNT_MISMATCH');
  if (amountMismatch.length > 0) {
    actionItems.push({
      priority: 'MEDIUM',
      action: `${amountMismatch.length} 筆金額不一致，可能因利率調整或提前還款，請確認：${amountMismatch.map(i => i.match_key).join(', ')}`,
    });
  }

  const latencyMs = Date.now() - startTime;
  logger.info(
    `[Reconcile] Complete: ${items.length} items ` +
    `(${items.filter(i => i.status === 'MATCHED').length} matched, ` +
    `${missingLedger.length} missing_ledger, ${missingLoan.length} missing_loan, ` +
    `${amountMismatch.length} mismatch) in ${latencyMs}ms`
  );

  return {
    period: period ?? 'all',
    entity_type: entityType,
    executed_at: new Date().toISOString(),
    overall_status: hasDiscrepancy ? 'DISCREPANCY' : 'MATCHED',
    ledger_total: ledgerTotal,
    loan_total: loanTotal,
    total_delta: totalDelta,
    items,
    action_items: actionItems,
  };
}
