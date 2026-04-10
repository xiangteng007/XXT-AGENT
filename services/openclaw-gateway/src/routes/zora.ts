/**
 * Zora Agent Route — 公益法人管家
 *
 * 負責全國性社團法人救難協會（assoc_rescue）的全部業務支援：
 *
 * POST /agents/zora/chat                — 自由問答（非營利法規/公益管理）
 *
 * POST /agents/zora/donation           — 登錄捐款
 * GET  /agents/zora/donation           — 查詢捐款記錄
 * GET  /agents/zora/donation/:id/receipt — 產生捐款收據
 * GET  /agents/zora/donation/report/annual — 年度捐款彙整
 *
 * POST /agents/zora/volunteer          — 新增志工
 * GET  /agents/zora/volunteer          — 志工清單
 * PATCH /agents/zora/volunteer/:id/service — 記錄志工服務時數
 *
 * POST /agents/zora/project            — 新增補助/專案計畫
 * GET  /agents/zora/project            — 專案清單
 * PATCH /agents/zora/project/:id/expense — 記錄專案支出
 *
 * POST /agents/zora/mission            — 新增救難任務
 * GET  /agents/zora/mission            — 任務清單
 *
 * GET  /agents/zora/report/public      — 年度公益報告（符合內政部格式）
 * GET  /agents/zora/report/finance     — 非營利基金收支報告
 * GET  /agents/zora/health             — Agent 狀態
 *
 * 設計原則：
 *   - 推理強制本地（qwen3:14b）
 *   - 捐款者個資為 CRITICAL 等級，永不出局域
 *   - 財務記錄自動 Write Request 至鳴鑫（基金會計模式）
 *   - 志工保險需求推送至安盾（依志願服務法）
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { agentChat } from '../inference-wrapper';
import { zoraSystemPrompt } from '../prompts';

export const zoraRouter = Router();

const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const GATEWAY_BASE        = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3100';
const AGENT_ID            = 'zora';
const MODEL               = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';


// ── In-memory Stores ──────────────────────────────────────────
const DONATIONS:   DonationRecord[]   = [];
const VOLUNTEERS:  VolunteerProfile[] = [];
const PROJECTS:    GrantProject[]     = [];
const MISSIONS:    RescueMission[]    = [];
const MAX = 2000;

// ── 型別定義 ─────────────────────────────────────────────────────

type DonationMethod = 'bank_transfer' | 'cash' | 'check' | 'online' | 'other';
type DonationType   = 'one_time' | 'recurring';

interface DonationRecord {
  donation_id:     string;
  donor_name:      string;     // PRIVATE
  donor_id_no?:    string;     // 身分證後4碼（CRITICAL — 收據用）
  donor_email?:    string;     // PRIVATE
  donor_address?:  string;     // PRIVATE（收據郵寄用）
  amount:          number;     // NT$
  donation_type:   DonationType;
  payment_method:  DonationMethod;
  purpose?:        string;     // 用途（一般捐款/特定專案）
  project_id?:     string;     // 若捐給特定專案
  receipt_issued:  boolean;
  receipt_no?:     string;
  donation_date:   string;     // YYYY-MM-DD
  tax_deductible:  boolean;
  notes?:          string;
  created_at:      string;
}

interface VolunteerProfile {
  volunteer_id:     string;
  name:             string;
  id_no_masked:     string;   // 後四碼
  birth_date?:      string;
  contact:          string;   // PRIVATE
  emergency_contact?: string;
  join_date:        string;
  skills:           string[];
  total_service_hrs: number;
  is_active:        boolean;
  insurance_enrolled: boolean; // 已投保志工保險
  notes?:           string;
  created_at:       string;
}

interface ServiceRecord {
  record_id:    string;
  volunteer_id: string;
  date:         string;
  hours:        number;
  activity:     string;
  notes?:       string;
}

const SERVICE_RECORDS: ServiceRecord[] = [];

interface GrantProject {
  project_id:    string;
  title:         string;
  grant_source:  string;    // 補助機關（如：社會局、勞動部）
  grant_amount:  number;    // NT$
  co_funding?:   number;    // 自籌款
  start_date:    string;
  end_date:      string;
  status:        'planning' | 'active' | 'reporting' | 'completed' | 'rejected';
  spent_amount:  number;    // 已核銷
  expenses:      GrantExpense[];
  notes?:        string;
  created_at:    string;
}

interface GrantExpense {
  expense_id: string;
  date:       string;
  amount:     number;
  description: string;
  receipt_no:  string;
}

type MissionStatus = 'standby' | 'mobilized' | 'active' | 'completed' | 'debrief';

interface RescueMission {
  mission_id:      string;
  title:           string;
  mission_type:    'search_and_rescue' | 'disaster_relief' | 'training' | 'support';
  location:        string;
  initiated_by:    string;   // 發起機關（警察局/消防局/民眾）
  start_time:      string;
  end_time?:       string;
  status:          MissionStatus;
  volunteer_ids:   string[];
  equipment_used:  string[];
  uav_requested:   boolean;  // 是否需要 Scout 協作無人機
  uav_mission_id?: string;   // Scout 任務 ID
  outcome?:        string;
  report_filed:    boolean;
  created_at:      string;
}

// ── 工具函數 ─────────────────────────────────────────────────────

function now(): string { return new Date().toISOString(); }

let RECEIPT_COUNTER = 1;
function generateReceiptNo(): string {
  const y = new Date().getFullYear();
  const seq = String(RECEIPT_COUNTER++).padStart(4, '0');
  return `REC-${y}-${seq}`;
}

/** 查詢非營利法規 RAG */
async function queryNonprofitRag(question: string): Promise<string> {
  try {
    const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, category: 'nonprofit', top_k: 4 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return '';
    const data = await resp.json() as { results?: Array<{ content: string; source: string }> };
    return (data.results ?? []).map(r => `【${r.source}】\n${r.content}`).join('\n\n---\n\n');
  } catch {
    return '';
  }
}

/** Write Request 至鳴鑫帳本（基金會計模式）— QVP 佇列化版 */
async function writeToFundAccounting(
  type: 'income' | 'expense',
  amount: number,
  description: string,
  project_id?: string,
): Promise<void> {
  const { writeRequestQueue } = await import('../write-request-queue');

  // 使用日期 + 描述 hash 作為冪等性金鑰，防止重複入帳
  const dateStr = now().slice(0, 10);
  const idempotencyKey = `zora_fund_${dateStr}_${type}_${amount}_${description.slice(0, 30).replace(/\s/g, '_')}`;

  const result = await writeRequestQueue.submit({
    source_agent:    'zora',
    target_agent:    'accountant',
    collection:      'accountant_ledger',
    operation:       'create',
    idempotency_key: idempotencyKey,
    entity_type:     'assoc_rescue',
    reason:          `Zora 基金會計記錄：${description}`,
    data: {
      type,
      category: type === 'income' ? 'other_income' : 'other_expense',
      description,
      amount_taxed: amount,
      amount_untaxed: amount,
      tax_amount: 0,
      tax_rate: 0,
      is_tax_exempt: true,
      entity_type: 'assoc_rescue',
      project_id,
      is_deductible: false,
      transaction_date: dateStr,
      notes: `[基金會計] ${description}`,
    },
  });

  if (!result.ok) {
    logger.warn(`[Zora] Write request to accountant failed: ${result.message}`);
  } else {
    logger.info(`[Zora] Write request queued: ${result.request_id} (${result.status})`);
  }
}

// ── POST /agents/zora/chat ────────────────────────────────────
zoraRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, session_id } = req.body as { message?: string; session_id?: string };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const ragContext = await queryNonprofitRag(message);
  const systemPrompt = ragContext
    ? `${zoraSystemPrompt.template}\n\n【相關法規（RAG）】\n${ragContext}`
    : zoraSystemPrompt.template;

  const result = await agentChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ], { agentId: AGENT_ID, action: 'ZORA_CHAT', sessionId: session_id, temperature: 0.2 });

  res.json({
    agent: AGENT_ID,
    session_id: session_id ?? crypto.randomUUID(),
    answer: result.content,
    latency_ms: result.latency_ms,
    rag_used: !!ragContext,
  });
});

// ── POST /agents/zora/donation ────────────────────────────────
zoraRouter.post('/donation', async (req: Request, res: Response) => {
  const body = req.body as Partial<DonationRecord>;

  if (!body.donor_name || !body.amount || !body.donation_date) {
    res.status(400).json({ error: 'donor_name, amount, donation_date are required' });
    return;
  }

  const donation: DonationRecord = {
    donation_id:    crypto.randomUUID(),
    donor_name:     body.donor_name,
    donor_id_no:    body.donor_id_no,
    donor_email:    body.donor_email,
    donor_address:  body.donor_address,
    amount:         body.amount,
    donation_type:  body.donation_type ?? 'one_time',
    payment_method: body.payment_method ?? 'bank_transfer',
    purpose:        body.purpose,
    project_id:     body.project_id,
    receipt_issued: false,
    tax_deductible: true,
    donation_date:  body.donation_date,
    notes:          body.notes,
    created_at:     now(),
  };

  if (DONATIONS.length >= MAX) DONATIONS.shift();
  DONATIONS.push(donation);

  // 寫入基金會計
  await writeToFundAccounting(
    'income',
    donation.amount,
    `捐款收入：${donation.donor_name}（${donation.purpose ?? '一般捐款'}）`,
    donation.project_id,
  );

  // 稅務提醒
  const taxReminder = donation.amount >= 100
    ? `依《所得稅法》§17，捐款者可申報捐贈列舉扣除，請確保收據在 1 月底前寄出。`
    : null;

  res.status(201).json({
    donation_id:    donation.donation_id,
    amount:         donation.amount,
    receipt_note:   '收據尚未開立，請呼叫 GET /donation/:id/receipt 產生',
    tax_reminder:   taxReminder,
  });
});

// ── GET /agents/zora/donation ─────────────────────────────────
zoraRouter.get('/donation', async (req: Request, res: Response) => {
  const { from, to, project_id, limit } = req.query as Record<string, string>;

  let results = [...DONATIONS].map(d => ({
    donation_id:   d.donation_id,
    donor_name:    d.donor_name,     // 保持顯示（管理介面）
    amount:        d.amount,
    donation_date: d.donation_date,
    payment_method: d.payment_method,
    purpose:       d.purpose,
    project_id:    d.project_id,
    receipt_issued: d.receipt_issued,
    receipt_no:    d.receipt_no,
    tax_deductible: d.tax_deductible,
    // 隱藏敏感個資
    donor_id_no:   d.donor_id_no ? `****${d.donor_id_no.slice(-4)}` : undefined,
    donor_email:   d.donor_email ? `${d.donor_email.slice(0, 2)}***` : undefined,
    donor_address: undefined,
  }));

  if (from)       results = results.filter(d => d.donation_date >= from);
  if (to)         results = results.filter(d => d.donation_date <= to);
  if (project_id) results = results.filter(d => d.project_id === project_id);

  const lim = Math.min(parseInt(limit ?? '50'), 200);
  results = results.slice(-lim).reverse();

  const total_amount = results.reduce((s, d) => s + d.amount, 0);

  res.json({ total: results.length, total_amount, donations: results });
});

// ── GET /agents/zora/donation/:id/receipt ─────────────────────
zoraRouter.get('/donation/:id/receipt', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const donation = DONATIONS.find(d => d.donation_id === id);

  if (!donation) {
    res.status(404).json({ error: 'Donation not found' });
    return;
  }

  if (!donation.receipt_no) {
    donation.receipt_no    = generateReceiptNo();
    donation.receipt_issued = true;
  }

  const year = new Date(donation.donation_date).getFullYear();

  res.json({
    receipt_no:       donation.receipt_no,
    receipt_type:     '捐款收據（符合所得稅法§17）',
    organization:     '全國性社團法人救難協會',
    donor_name:       donation.donor_name,
    amount:           donation.amount,
    amount_in_words:  `新台幣${donation.amount.toLocaleString()}元整`,
    donation_date:    donation.donation_date,
    purpose:          donation.purpose ?? '協會一般業務',
    tax_year:         year,
    deduction_limit:  '捐款金額20%所得額（依所得稅法§17）',
    issued_date:      now().slice(0, 10),
    note:             '本收據請妥善保存，作為綜合所得稅申報憑證',
    _cavp_privacy:    'CRITICAL — 此收據含捐款者個資，不得外傳',
  });
});

// ── GET /agents/zora/donation/report/annual ───────────────────
zoraRouter.get('/donation/report/annual', async (req: Request, res: Response) => {
  const { year } = req.query as { year?: string };
  const y = parseInt(year ?? String(new Date().getFullYear()));

  const yearDonations = DONATIONS.filter(d => d.donation_date.startsWith(String(y)));
  const total = yearDonations.reduce((s, d) => s + d.amount, 0);

  const byMonth: Record<string, number> = {};
  for (const d of yearDonations) {
    const m = d.donation_date.slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + d.amount;
  }

  const byProject: Record<string, number> = {};
  for (const d of yearDonations) {
    const p = d.project_id ?? 'general';
    byProject[p] = (byProject[p] ?? 0) + d.amount;
  }

  res.json({
    tax_year:         y,
    total_donations:  yearDonations.length,
    total_amount:     total,
    by_month:         byMonth,
    by_project:       byProject,
    receipt_coverage: yearDonations.filter(d => d.receipt_issued).length,
    _note:            '年度捐款彙整應於次年1月底前完成收據寄送',
  });
});

// ── POST /agents/zora/volunteer ───────────────────────────────
zoraRouter.post('/volunteer', async (req: Request, res: Response) => {
  const body = req.body as Partial<VolunteerProfile>;

  if (!body.name || !body.id_no_masked || !body.join_date) {
    res.status(400).json({ error: 'name, id_no_masked, join_date are required' });
    return;
  }

  const volunteer: VolunteerProfile = {
    volunteer_id:      crypto.randomUUID(),
    name:              body.name,
    id_no_masked:      body.id_no_masked,
    birth_date:        body.birth_date,
    contact:           body.contact ?? '',
    emergency_contact: body.emergency_contact,
    join_date:         body.join_date,
    skills:            body.skills ?? [],
    total_service_hrs: 0,
    is_active:         true,
    insurance_enrolled: false,
    notes:             body.notes,
    created_at:        now(),
  };

  if (VOLUNTEERS.length >= MAX) VOLUNTEERS.shift();
  VOLUNTEERS.push(volunteer);

  res.status(201).json({
    volunteer_id: volunteer.volunteer_id,
    insurance_reminder: '⚠️ 請確認已為該志工投保團體意外保險（依《志願服務法》§16）',
    training_reminder:  '依規定，新進志工應完成志願服務基礎訓練（12小時）及特殊訓練方可服務',
  });
});

// ── GET /agents/zora/volunteer ────────────────────────────────
zoraRouter.get('/volunteer', async (req: Request, res: Response) => {
  const { active_only } = req.query as { active_only?: string };

  let results = [...VOLUNTEERS];
  if (active_only === 'true') results = results.filter(v => v.is_active);

  const uninsured = results.filter(v => !v.insurance_enrolled).length;

  res.json({
    total: results.length,
    insurance_warnings: uninsured,
    alert: uninsured > 0 ? `⚠️ 有 ${uninsured} 位志工尚未確認投保` : null,
    volunteers: results.map(v => ({
      ...v,
      contact: '****',          // 隱藏聯絡方式
      emergency_contact: '****',
    })),
  });
});

// ── PATCH /agents/zora/volunteer/:id/service ─────────────────
zoraRouter.patch('/volunteer/:id/service', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { date, hours, activity, notes } = req.body as {
    date: string;
    hours: number;
    activity: string;
    notes?: string;
  };

  const volunteer = VOLUNTEERS.find(v => v.volunteer_id === id);
  if (!volunteer) {
    res.status(404).json({ error: 'Volunteer not found' });
    return;
  }

  const record: ServiceRecord = {
    record_id:    crypto.randomUUID(),
    volunteer_id: id,
    date, hours, activity, notes,
  };

  SERVICE_RECORDS.push(record);
  volunteer.total_service_hrs += hours;

  res.json({
    volunteer_name:    volunteer.name,
    added_hours:       hours,
    total_service_hrs: volunteer.total_service_hrs,
    record_id:         record.record_id,
  });
});

// ── POST /agents/zora/mission ────────────────────────────────
zoraRouter.post('/mission', async (req: Request, res: Response) => {
  const body = req.body as Partial<RescueMission>;

  if (!body.title || !body.location || !body.start_time) {
    res.status(400).json({ error: 'title, location, start_time are required' });
    return;
  }

  const mission: RescueMission = {
    mission_id:     crypto.randomUUID(),
    title:          body.title,
    mission_type:   body.mission_type ?? 'search_and_rescue',
    location:       body.location,
    initiated_by:   body.initiated_by ?? '未知',
    start_time:     body.start_time,
    end_time:       body.end_time,
    status:         'mobilized',
    volunteer_ids:  body.volunteer_ids ?? [],
    equipment_used: body.equipment_used ?? [],
    uav_requested:  body.uav_requested ?? false,
    uav_mission_id: body.uav_mission_id,
    report_filed:   false,
    created_at:     now(),
  };

  if (MISSIONS.length >= MAX) MISSIONS.shift();
  MISSIONS.push(mission);

  const response: Record<string, unknown> = {
    mission_id: mission.mission_id,
    status: mission.status,
  };

  // 若請求無人機支援
  if (mission.uav_requested && !mission.uav_mission_id) {
    response['uav_coordination'] = '⚠️ 已記錄無人機需求，請聯繫 Scout（UAV 任務官）安排空中支援';
    response['scout_endpoint']   = 'POST /agents/scout/mission (rescue_support type)';
  }

  // 未投保志工警示
  const missionVolunteers = VOLUNTEERS.filter(v => mission.volunteer_ids.includes(v.volunteer_id));
  const uninsuredInMission = missionVolunteers.filter(v => !v.insurance_enrolled);
  if (uninsuredInMission.length > 0) {
    response['insurance_alert'] = `⛔ ${uninsuredInMission.length} 位出勤志工尚未投保，請立即確認保險狀態`;
  }

  res.status(201).json(response);
});

// ── GET /agents/zora/report/finance ──────────────────────────
zoraRouter.get('/report/finance', async (req: Request, res: Response) => {
  const { year } = req.query as { year?: string };
  const y = parseInt(year ?? String(new Date().getFullYear()));

  const yearDonations = DONATIONS.filter(d => d.donation_date.startsWith(String(y)));
  const totalIncome = yearDonations.reduce((s, d) => s + d.amount, 0);

  const yearProjects = PROJECTS.filter(p => p.start_date.startsWith(String(y)));
  const grantIncome = yearProjects.reduce((s, p) => s + p.grant_amount, 0);
  const projectExpense = yearProjects.reduce((s, p) => s + p.spent_amount, 0);

  res.json({
    year: y,
    report_type: '非營利基金收支報告（基金會計格式）',
    fund_summary: {
      general_fund: {
        label: '一般基金',
        income:  totalIncome,
        expense: projectExpense,
        balance: totalIncome - projectExpense,
      },
      project_fund: {
        label:   '專案基金（政府補助）',
        income:  grantIncome,
        expense: projectExpense,
        balance: grantIncome - projectExpense,
      },
    },
    total_income:  totalIncome + grantIncome,
    total_expense: projectExpense,
    net_surplus:   (totalIncome + grantIncome) - projectExpense,
    note: '本期收支差額（非營利組織不稱利潤）',
    volunteer_hours: VOLUNTEERS.reduce((s, v) => s + v.total_service_hrs, 0),
    _compliance: '此報告應每年送內政部備查，並於協會年會中公告',
  });
});

// ── GET /agents/zora/health ───────────────────────────────────
zoraRouter.get('/health', async (_req: Request, res: Response) => {
  const uninsuredVolunteers = VOLUNTEERS.filter(v => v.is_active && !v.insurance_enrolled);
  const activeMissions = MISSIONS.filter(m => m.status === 'active' || m.status === 'mobilized');

  res.json({
    agent: AGENT_ID,
    status: 'online',
    entity_scope: 'assoc_rescue',
    stats: {
      total_donations:   DONATIONS.length,
      total_volunteers:  VOLUNTEERS.length,
      total_projects:    PROJECTS.length,
      total_missions:    MISSIONS.length,
      active_missions:   activeMissions.length,
      uninsured_volunteers: uninsuredVolunteers.length,
    },
    alerts: [
      ...uninsuredVolunteers.map(v => `⛔ 志工 ${v.name} 尚未投保`),
      ...activeMissions.map(m => `🚨 進行中任務：${m.title}（${m.location}）`),
    ],
    timestamp: now(),
  });
});
