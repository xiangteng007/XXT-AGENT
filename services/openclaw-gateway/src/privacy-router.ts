/**
 * Privacy Router — NemoClaw Layer 2
 *
 * 在所有 AI 請求送出前掃描分類，決定走本地 Ollama 或雲端 AI Gateway。
 *
 * 分類規則：
 *   🔴 PRIVATE  → 強制 local（Ollama），資料不出境
 *   🟡 INTERNAL → 優先 local，local 不可用則 fallback 雲端
 *   🟢 PUBLIC   → 可走雲端（預設），或依 PRIVACY_ENFORCE_LOCAL=true 全走本地
 *
 * 憲法依據（constitution.md Part 4）：
 *   本機 RTX 4080 SUPER 16GB VRAM，VRAM 預算 14GB
 *   LOCAL_RUNNER_BASE_URL=http://localhost:11434
 */

import { logger } from './logger';

// ── 設定 ──────────────────────────────────────────────────────
const PRIVACY_ENFORCE_LOCAL = process.env['PRIVACY_ENFORCE_LOCAL'] === 'true';
const PRIVACY_LOG_REDACTED = process.env['PRIVACY_LOG_REDACTED_PROMPTS'] !== 'false';  // 預設 true，但建議 false

// ── 型別 ──────────────────────────────────────────────────────
export type PrivacyLevel = 'PRIVATE' | 'INTERNAL' | 'PUBLIC';
export type InferenceRoute = 'local' | 'cloud';

export interface PrivacyClassification {
  level: PrivacyLevel;
  routeTo: InferenceRoute;
  detectedKeywords: string[];
  reason: string;
}

// ── H-05: 加權敏感詞庫（weight: high=3, medium=2, low=1）────────

interface ScoredKeyword {
  keyword: string;
  weight: number;
}

/** 🔴 PRIVATE：加權後超過閾值才判定 */
const PRIVATE_SCORED_KEYWORDS: ScoredKeyword[] = [
  // 投資財務 (high)
  ...['持倉', '倉位', '部位', '損益', '盈虧', '買進', '賣出', '停損', '停利', '目標價',
    '投資策略', '交易計畫', '部位管理', '已實現損益', '未實現', '融資', '融券', '借券']
    .map(k => ({ keyword: k, weight: 3 })),
  // 工程合約 (high)
  ...['合約金額', '報價單', '標案金額', '底價', '預算書', '決標', '招標文件', '議價']
    .map(k => ({ keyword: k, weight: 3 })),
  // 個人身份 (high)
  ...['身分證', '護照號', '銀行帳號', '信用卡', '密碼', 'token', 'secret', 'api key',
    'apikey', 'private key', '私鑰', '助記詞']
    .map(k => ({ keyword: k, weight: 3 })),
  // 人事稅務 (high)
  ...['薪資', '薪水', '月薪', '年薪', '獎金', '考績', '績效評分', '稅務申報', '逃漏稅', '所得稅申報']
    .map(k => ({ keyword: k, weight: 3 })),
  // 健康資料 (medium) — 降權避免假陽性
  ...['病歷', '診斷', '用藥', '健康紀錄', '體檢']
    .map(k => ({ keyword: k, weight: 2 })),
  // 一般敏感 (low) — 容易假陽性的詞彙降至最低
  ...['血壓', '血糖', '體重', '資金', '成本價', '均價', '工程款',
    '廠商報價', '比價', '詢價', '採購金額', '付款條件',
    '勞保投保薪資', '勞退', '員工個資', '稅率', '扣繳',
    '目前位置', '我在哪', 'gps座標', '即時位置']
    .map(k => ({ keyword: k, weight: 1 })),
];

/** PRIVATE 判定閾值（加權分數需 >= 此值） */
const PRIVATE_THRESHOLD = 3;

/** 白名單 Agent（永遠走 PUBLIC/cloud） */
const PUBLIC_WHITELIST_AGENTS = ['titan', 'lumi', 'rusty'];

/** 🟡 INTERNAL：優先走本地，可 fallback 雲端 */
const INTERNAL_KEYWORDS = [
  // 分析類
  '走勢分析', '技術分析', '法規查詢', '材料計算', '算量',
  '建蔽率', '容積率', '消防', 'cns', '結構', '工地',
  // 台灣建築法規
  '建築技術規則', '建築法', '都市計畫', '使用分區', '容積移轉',
  '建築執照', '使用執照', '雜項執照', '施工許可',
  // 業務系統
  '專案', '工程', '施工', '材料', '工班', '工地日誌',
  '發票', '請款', '報表', '統計', '合約', '廠商',
  // 環保、安全
  '廢棄物', '環評', '噪音管制', '空污', '水污',
  '職業安全', '勞安', '工安', '安全衛生',
  // Agent 協作
  '分析', '規劃', '評估', '建議', '優化', '預測', '摘要',
] as const;

// ── 核心分類函數 ──────────────────────────────────────────────
/**
 * 掃描 prompt（和可選 context），回傳隱私等級與路由決策
 * H-05: 升級為加權評分制，降低假陽性
 */
export function classify(
  prompt: string,
  context?: string,
  agentId?: string,
): PrivacyClassification {
  const text = `${prompt} ${context ?? ''}`.toLowerCase();

  // 1. 加權掃描 PRIVATE 詞彙 (Security First: 最優先攔截，無懼白名單)
  let privateScore = 0;
  const detectedKeywords: string[] = [];
  for (const { keyword, weight } of PRIVATE_SCORED_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      detectedKeywords.push(keyword);
      privateScore += weight;
    }
  }

  if (privateScore >= PRIVATE_THRESHOLD) {
    logger.info(`[PrivacyRouter] PRIVATE (score=${privateScore}): [${detectedKeywords.slice(0, 5).join(', ')}] → local`);
    return {
      level: 'PRIVATE',
      routeTo: 'local',
      detectedKeywords,
      reason: `Sensitive score ${privateScore} >= ${PRIVATE_THRESHOLD}: ${detectedKeywords.slice(0, 3).join(', ')}`,
    };
  }

  // 白名單 Agent（工程部門等）若無重度機密詞彙，預設走 PUBLIC
  if (agentId && PUBLIC_WHITELIST_AGENTS.includes(agentId)) {
    return {
      level: 'PUBLIC',
      routeTo: PRIVACY_ENFORCE_LOCAL ? 'local' : 'cloud',
      detectedKeywords: [],
      reason: `Agent ${agentId} is whitelisted for public routing`,
    };
  }

  // 2. 掃描 INTERNAL 詞彙
  const internalDetected: string[] = [];
  for (const kw of INTERNAL_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      internalDetected.push(kw);
    }
  }

  if (internalDetected.length > 0) {
    // INTERNAL 預設走 local（有 RTX 4080S），但 PRIVACY_ENFORCE_LOCAL=false 時允許 cloud fallback
    const routeTo: InferenceRoute = PRIVACY_ENFORCE_LOCAL ? 'local' : 'cloud';
    logger.debug(`[PrivacyRouter] INTERNAL detected: [${internalDetected.slice(0, 3).join(', ')}] → ${routeTo}`);
    return {
      level: 'INTERNAL',
      routeTo,
      detectedKeywords: internalDetected,
      reason: `Internal domain keywords: ${internalDetected.slice(0, 3).join(', ')}`,
    };
  }

  // 3. PUBLIC：強制本地模式或走雲端
  const routeTo: InferenceRoute = PRIVACY_ENFORCE_LOCAL ? 'local' : 'cloud';
  logger.debug(`[PrivacyRouter] PUBLIC → ${routeTo}`);
  return {
    level: 'PUBLIC',
    routeTo,
    detectedKeywords: [],
    reason: 'No sensitive keywords detected',
  };
}

/**
 * 根據分類決定推理 endpoint URL
 *
 * @param classification - classify() 的輸出
 * @param localBase      - Ollama base URL（預設讀 LOCAL_RUNNER_BASE_URL）
 * @param cloudBase      - AI Gateway base URL（預設讀 AI_GATEWAY_URL）
 */
export function resolveEndpoint(
  classification: PrivacyClassification,
  localBase = process.env['LOCAL_RUNNER_BASE_URL'] ?? 'http://localhost:11434',
  cloudBase = process.env['AI_GATEWAY_URL'] ?? 'http://localhost:8080',
): string {
  return classification.routeTo === 'local'
    ? `${localBase}/v1/chat/completions`
    : `${cloudBase}/v1/chat/completions`;
}

/**
 * 根據分類決定使用的模型名稱
 */
export function resolveModel(
  classification: PrivacyClassification,
  localModel = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b',
  cloudModel = 'gemini-2.5-flash',
): string {
  return classification.routeTo === 'local' ? localModel : cloudModel;
}

/**
 * 將 PRIVATE prompt 的前段內容遮蔽，用於稽核 log
 * 確保稽核記錄中不會出現敏感資料明文
 */
export function redactForLog(
  prompt: string,
  level: PrivacyLevel,
): string {
  if (level === 'PRIVATE') {
    if (!PRIVACY_LOG_REDACTED) return '[REDACTED]';
    // 只保留前 20 字並打碼
    const preview = prompt.slice(0, 20).replace(/./g, '*');
    return `[REDACTED:${preview}...]`;
  }
  // INTERNAL/PUBLIC 只截取前 100 字
  return prompt.slice(0, 100) + (prompt.length > 100 ? '...' : '');
}

// ── Singleton-style export for convenience ────────────────────
export const PrivacyRouter = { classify, resolveEndpoint, resolveModel, redactForLog };
