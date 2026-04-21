/**
 * Accountant — Ledger Sub-router (A-3 / CR-02)
 *
 * POST /agents/accountant/ledger          — 新增收支記錄
 * GET  /agents/accountant/ledger          — 查詢收支明細
 * GET  /agents/accountant/report/summary  — 期間彙總表
 * GET  /agents/accountant/report/401      — 401 申報表
 * GET  /agents/accountant/report/annual   — 年度彙總
 * GET  /agents/accountant/export/csv      — CSV 匯出
 *
 * 拆分自 routes/accountant.ts（原 L468-L636）
 */

import * as crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { logger } from '../../logger';
import {
  addEntry, queryEntries, calcPeriodSummary, calcYearSummary,
  generate401Report, generateLedgerCsv, calcPeriod, deleteEntry,
  type LedgerEntry, type LedgerCategory, type EntryType, type EntityType,
} from '../../ledger-store';
import { addBankTransaction, type BankTransaction } from '../../bank-store';

export const ledgerRouter = Router();

// ── POST /ledger ── 新增收支記錄 ─────────────────────────────
/**
 * @openapi
 * /agents/accountant/ledger:
 *   post:
 *     tags: [Accountant]
 *     summary: 新增收支記錄
 *     description: |
 *       建立帳本記錄，支援含稅/未稅轉換、實體分類（個人/家庭/公司）。
 *       資料持久化至 Firestore `accountant_ledger` 集合。
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LedgerEntry'
 *           example:
 *             type: income
 *             category: engineering_payment
 *             description: 南港捷運工程 6月請款
 *             amount: 1050000
 *             amount_type: taxed
 *             entity_type: co_construction
 *             invoice_no: AB-12345678
 *     responses:
 *       201:
 *         description: 記錄建立成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:       { type: boolean }
 *                 entry_id: { type: string, format: uuid }
 *                 message:  { type: string }
 *       400:
 *         description: 必填欄位缺失
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Accountant]
 *     summary: 查詢收支明細
 *     security:
 *       - FirebaseAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [income, expense, all] }
 *       - in: query
 *         name: period
 *         schema: { type: string, example: "202604" }
 *         description: 兩個月申報期間（YYYYMM）
 *       - in: query
 *         name: entity_type
 *         schema: { type: string, enum: [personal, family, co_construction, co_renovation, co_design, co_drone, assoc_rescue] }
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: 查詢成功
 */
ledgerRouter.post('/ledger', async (req: Request, res: Response) => {
  const {
    type, category, description, amount,
    amount_type = 'taxed', tax_rate = 5, is_tax_exempt = false,
    transaction_date, invoice_no, invoice_type = 'three_copy',
    counterparty_name, counterparty_tax_id,
    project_id, is_deductible, notes,
    company_id = 'senteng', user_id,
    entity_type = 'co_construction', payment_method, bank_account_id,
  } = req.body as {
    type?: EntryType; category?: LedgerCategory;
    description?: string; amount?: number;
    amount_type?: 'taxed' | 'untaxed'; tax_rate?: number; is_tax_exempt?: boolean;
    transaction_date?: string; invoice_no?: string; invoice_type?: string;
    counterparty_name?: string; counterparty_tax_id?: string;
    project_id?: string; is_deductible?: boolean; notes?: string;
    company_id?: string; user_id?: string;
    entity_type?: EntityType; payment_method?: string; bank_account_id?: string;
  };

  if (!type || !category || !description || !amount || amount <= 0) {
    res.status(400).json({
      error: 'type, category, description, amount are required',
      income_categories: ['engineering_payment','advance_payment','design_fee','consulting_fee','material_rebate','other_income','salary','freelance','rental_income','investment_gain','allowance'],
      expense_categories: ['material','labor','subcontract','equipment','overhead','insurance','tax_payment','utilities','rent','office_supply','entertainment','transportation','professional_service','other_expense','medical','education','life_insurance','house_rent','family_living'],
      entity_types: ['personal','family','co_drone','co_construction','co_renovation','co_design','assoc_rescue'],
    });
    return;
  }

  const rate = is_tax_exempt ? 0 : tax_rate / 100;
  let amount_untaxed: number, tax_amount: number, amount_taxed: number;
  if (amount_type === 'taxed') {
    amount_taxed = Math.round(amount); amount_untaxed = Math.round(amount / (1 + rate)); tax_amount = amount_taxed - amount_untaxed;
  } else {
    amount_untaxed = Math.round(amount); tax_amount = Math.round(amount * rate); amount_taxed = amount_untaxed + tax_amount;
  }

  const txDate = transaction_date ?? new Date().toISOString().slice(0, 10);
  const period = calcPeriod(txDate);
  const entryId = crypto.randomUUID();

  const entry: LedgerEntry = {
    entry_id: entryId, company_id, project_id,
    entity_type: entity_type as EntityType,
    type, category, description,
    amount_untaxed, tax_amount, amount_taxed,
    tax_rate: is_tax_exempt ? 0 : tax_rate, is_tax_exempt,
    invoice: invoice_no ? {
      invoice_no,
      invoice_type: invoice_type as 'two_copy' | 'three_copy' | 'electronic' | 'receipt',
      buyer_name: counterparty_name,
      buyer_tax_id: counterparty_tax_id,
    } : undefined,
    counterparty_name, counterparty_tax_id,
    payment_method: payment_method as LedgerEntry['payment_method'],
    bank_account_id,
    transaction_date: txDate, period,
    created_at: new Date().toISOString(),
    created_by: user_id ?? 'accountant-bot',
    is_deductible: type === 'expense' ? (is_deductible ?? true) : undefined,
    notes,
  };

  await addEntry(entry);
  logger.info(`[Ledger] ${type} ${entryId} NT$${amount_taxed} ${category} period=${period}`);

  let dual_write = false;
  let bank_txn_id: string | undefined;

  if (payment_method === 'bank_transfer' && bank_account_id) {
    try {
      bank_txn_id = crypto.randomUUID();
      const txn: BankTransaction = {
        txn_id: bank_txn_id,
        account_id: bank_account_id,
        entity_type: entity_type as EntityType,
        type: type === 'income' ? 'credit' : 'debit',
        amount: amount_taxed,
        txn_date: txDate,
        description: description,
        counterparty: counterparty_name,
        ledger_category: category,
        payment_method: 'bank_transfer',
        linked_entry_id: entryId,
        created_at: new Date().toISOString(),
        created_by: user_id ?? 'accountant-bot',
      };
      await addBankTransaction(txn);
      dual_write = true;
    } catch (dualWriteErr) {
      logger.error(`[Accountant] CRITICAL: Dual write failed for LedgerEntry ${entryId}. BankTransaction was NOT created. Compensating... Error: ${String(dualWriteErr)}`);
      await deleteEntry(entryId);
      res.status(500).json({ error: 'Dual write failed (BankTransaction). LedgerEntry was rolled back.' });
      return;
    }
  }

  const entityLabel = entity_type === 'personal' ? '個人' : entity_type === 'family' ? '家庭' : '公司';
  res.status(201).json({
    ok: true, entry_id: entryId, dual_write, bank_txn_id,
    summary: { type, category, description, amount_untaxed, tax_amount, amount_taxed, period, transaction_date: txDate, entity_type, entity_label: entityLabel },
    message: `已記入帳本（${entityLabel}）：${type === 'income' ? '收入' : '支出'} NT$${amount_taxed.toLocaleString()} · ${description}`,
  });
});

// ── GET /ledger ── 查詢收支明細 ──────────────────────────────
ledgerRouter.get('/ledger', async (req: Request, res: Response) => {
  const { type, period, project_id, category, date_from, date_to, limit, entity_type, year } =
    req.query as Record<string, string | undefined>;

  const validEntities: EntityType[] = ['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'];
  const entries = await queryEntries({
    type: (type as EntryType | 'all') ?? 'all', period, project_id,
    category: category as LedgerCategory,
    entity_type: validEntities.includes(entity_type as EntityType) ? entity_type as EntityType : undefined,
    date_from, date_to,
    year: year ? parseInt(year) : undefined,
    limit: limit ? parseInt(limit) : 100,
  });

  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount_taxed, 0);
  const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount_taxed, 0);

  res.json({
    count: entries.length,
    query: { type: type ?? 'all', period, entity_type: entity_type ?? 'all', year },
    summary: { total_income: totalIncome, total_expense: totalExpense, net: totalIncome - totalExpense },
    entries: entries.map(e => ({ ...e, entity_label: e.entity_type === 'personal' ? '個人' : e.entity_type === 'family' ? '家庭' : '公司' })),
  });
});

// ── GET /report/summary ── 期間彙總 ──────────────────────────
ledgerRouter.get('/report/summary', async (req: Request, res: Response) => {
  const { period } = req.query as { period?: string };
  if (!period || !/^\d{6}$/.test(period)) { res.status(400).json({ error: 'period required (YYYYMM)' }); return; }
  res.json(await calcPeriodSummary(period));
});

// ── GET /report/401 ── 401 申報表 ────────────────────────────
ledgerRouter.get('/report/401', async (req: Request, res: Response) => {
  const { period, company_name = 'SENTENG 建工股份有限公司', tax_id = '' } =
    req.query as { period?: string; company_name?: string; tax_id?: string };
  if (!period || !/^\d{6}$/.test(period)) { res.status(400).json({ error: 'period required (YYYYMM)' }); return; }
  const summary = await calcPeriodSummary(period);
  res.json({
    generated_by: 'accountant-agent-v1',
    disclaimer: '⚠️ 本表由鳴鑫會計師 AI 自動生成，申報前請核對實際發票資料再由負責人簽章申報',
    report: generate401Report(summary, company_name, tax_id),
    raw_summary: summary,
  });
});

// ── GET /report/annual ── 年度彙總 ───────────────────────────
ledgerRouter.get('/report/annual', async (req: Request, res: Response) => {
  const { year } = req.query as { year?: string };
  const y = year ? parseInt(year) : new Date().getFullYear();
  if (isNaN(y) || y < 2020 || y > 2100) { res.status(400).json({ error: 'year must be valid (e.g. 2026)' }); return; }
  res.json({ generated_by: 'accountant-agent-v1', ...(await calcYearSummary(y)) });
});

// ── GET /export/csv ── CSV 匯出 ───────────────────────────────
ledgerRouter.get('/export/csv', async (req: Request, res: Response) => {
  const { period, year } = req.query as { period?: string; year?: string };
  if (!period && !year) { res.status(400).json({ error: 'period (YYYYMM) or year (YYYY) required' }); return; }
  const csv = await generateLedgerCsv(period, year ? parseInt(year) : undefined);
  const filename = period ? `收支明細_${period}.csv` : `收支明細_${year}年.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send('\uFEFF' + csv);
});
