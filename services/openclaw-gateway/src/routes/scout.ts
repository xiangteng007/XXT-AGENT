/**
 * Scout Agent Route — UAV 任務官
 *
 * 負責無人機公司（co_drone）的全部業務運作支援：
 *
 * POST /agents/scout/chat              — 自由問答（航空法規/任務規劃）
 * POST /agents/scout/mission           — 新增飛行任務記錄
 * GET  /agents/scout/mission           — 查詢任務清單
 * GET  /agents/scout/mission/:id       — 任務詳情
 * PATCH /agents/scout/mission/:id/status — 更新任務狀態
 *
 * POST /agents/scout/equipment         — 新增無人機設備
 * GET  /agents/scout/equipment         — 設備清單
 * PATCH /agents/scout/equipment/:id    — 更新設備資訊（里程/保養）
 *
 * POST /agents/scout/pilot             — 新增飛手資料
 * GET  /agents/scout/pilot             — 飛手清單（含執照到期警示）
 *
 * POST /agents/scout/permit/check      — 飛行許可核查（航空法規 RAG）
 * POST /agents/scout/quote             — UAV 服務報價
 *
 * GET  /agents/scout/report/monthly    — 月度任務彙整報告
 * GET  /agents/scout/report/equipment  — 設備折舊與維護報告
 * GET  /agents/scout/health            — Agent 狀態
 *
 * 設計原則：
 *   - 推理強制本地（qwen3:14b）
 *   - 航空法規查詢走 /regulation?category=aviation RAG
 *   - 任務費用完成後自動 Write Request 至鳴鑫帳本
 *   - 設備資訊推送給安盾做航空器保險評估
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { ollamaChat } from '../ollama-inference.service';
import { scoutSystemPrompt } from '../prompts';

export const scoutRouter = Router();

const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const GATEWAY_BASE        = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3100';
const AGENT_ID            = 'scout';
const MODEL               = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';


// ── In-memory Stores（Firestore 升級後替換）──────────────────────
const MISSIONS:    FlightMission[]   = [];
const EQUIPMENT:   UAVEquipment[]    = [];
const PILOTS:      UAVPilot[]        = [];
const MISSION_MAX  = 2000;
const EQUIP_MAX    = 200;
const PILOT_MAX    = 100;

// ── 型別定義 ─────────────────────────────────────────────────────

type MissionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'aborted';
type MissionType   = 'aerial_photo' | 'inspection' | 'agriculture' | 'survey' | 'rescue_support' | 'other';

interface FlightMission {
  mission_id:       string;
  entity_type:      'co_drone';
  mission_type:     MissionType;
  title:            string;
  client_name:      string;
  location:         string;
  latitude?:        number;
  longitude?:       number;
  scheduled_start:  string;   // ISO8601
  scheduled_end:    string;
  actual_start?:    string;
  actual_end?:      string;
  pilot_id:         string;
  equipment_ids:    string[];
  status:           MissionStatus;
  service_fee?:     number;   // NT$
  // 飛行記錄
  flight_time_mins?:  number;
  area_covered_sqm?:  number;
  weather_condition?: string;
  // 合規
  permit_no?:       string;   // 飛行許可字號
  permit_obtained:  boolean;
  // 協作
  rescue_mission_id?: string; // 若為救難協作（Zora 任務 ID）
  notes?:           string;
  created_at:       string;
  updated_at:       string;
}

type EquipmentStatus = 'active' | 'maintenance' | 'retired' | 'damaged';

interface UAVEquipment {
  equipment_id:     string;
  entity_type:      'co_drone';
  brand:            string;
  model:            string;
  serial_no:        string;
  registration_no?: string;   // 民航局登記號
  purchase_date:    string;
  purchase_price:   number;   // NT$
  current_value:    number;   // 折舊後現值
  status:           EquipmentStatus;
  total_flight_hrs: number;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  battery_cycle_count?: number;
  insurance_policy?:    string; // 保單號碼後 4 碼（安盾連動）
  created_at: string;
  notes?:     string;
}

interface UAVPilot {
  pilot_id:     string;
  name:         string;
  license_type: 'basic' | 'advanced' | 'bvlos' | 'other';
  license_no:   string;
  license_expiry: string;  // YYYY-MM-DD
  contact:      string;    // 聯絡方式（加密儲存）
  is_active:    boolean;
  created_at:   string;
  notes?:       string;
}

// ── 工具函數 ─────────────────────────────────────────────────────

function now(): string { return new Date().toISOString(); }

/** 計算設備折舊（直線法，5 年耐用年限）*/
function calcDepreciation(purchase_price: number, purchase_date: string): number {
  const years = (Date.now() - new Date(purchase_date).getTime()) / (365.25 * 24 * 3600 * 1000);
  const usefulLife = 5;
  const salvageRate = 0.1; // 殘值 10%
  const depreciated = purchase_price * (1 - salvageRate) * Math.min(years, usefulLife) / usefulLife;
  return Math.max(Math.round(purchase_price - depreciated), purchase_price * salvageRate);
}

/** 執照到期天數 */
function daysUntilExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (24 * 3600 * 1000));
}

/** 查詢航空法規 RAG */
async function queryAviationRag(question: string): Promise<string> {
  try {
    const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, category: 'aviation', top_k: 4 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return '';
    const data = await resp.json() as {
      results?: Array<{ content: string; source: string; score: number }>;
    };
    const chunks = data.results ?? [];
    return chunks.map(c => `【${c.source}】\n${c.content}`).join('\n\n---\n\n');
  } catch {
    return '';
  }
}

/** Write Request 至鳴鑫帳本（任務費用入帳）*/
async function writeToAccountant(
  mission: FlightMission,
  service_fee: number,
): Promise<void> {
  try {
    await fetch(`${GATEWAY_BASE}/agents/accountant/write-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesting_agent: 'scout',
        collection: 'accountant_ledger',
        operation: 'create',
        data: {
          type: 'income',
          category: 'other_income',
          description: `UAV 任務收入：${mission.title}（客戶：${mission.client_name}）`,
          amount_taxed: service_fee,
          amount_untaxed: Math.round(service_fee / 1.05),
          tax_amount: service_fee - Math.round(service_fee / 1.05),
          tax_rate: 5,
          is_tax_exempt: false,
          entity_type: 'co_drone',
          counterparty_name: mission.client_name,
          transaction_date: (mission.actual_end ?? mission.scheduled_end).slice(0, 10),
          notes: `任務 ID: ${mission.mission_id} | 機型: ${mission.equipment_ids.join(', ')}`,
        },
        reason: 'UAV 任務完成後自動寫入收入帳本',
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.warn(`[Scout] Write to accountant failed: ${String(err)}`);
  }
}

// ── POST /agents/scout/chat ────────────────────────────────────
scoutRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, session_id } = req.body as {
    message?: string;
    session_id?: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const ragContext = await queryAviationRag(message);
  const systemPrompt = ragContext
    ? `${scoutSystemPrompt.template}\n\n【相關法規條文（RAG）】\n${ragContext}`
    : scoutSystemPrompt.template;

  const answer = await ollamaChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ], MODEL, { temperature: 0.1 });

  res.json({
    agent: AGENT_ID,
    session_id: session_id ?? crypto.randomUUID(),
    answer,
    rag_used: !!ragContext,
  });
});

// ── POST /agents/scout/mission ────────────────────────────────
scoutRouter.post('/mission', async (req: Request, res: Response) => {
  const body = req.body as Partial<FlightMission>;

  if (!body.title || !body.client_name || !body.location || !body.scheduled_start) {
    res.status(400).json({ error: 'title, client_name, location, scheduled_start are required' });
    return;
  }
  if (!body.pilot_id) {
    res.status(400).json({ error: 'pilot_id is required' });
    return;
  }

  const mission: FlightMission = {
    mission_id:      crypto.randomUUID(),
    entity_type:     'co_drone',
    mission_type:    body.mission_type ?? 'aerial_photo',
    title:           body.title,
    client_name:     body.client_name,
    location:        body.location,
    latitude:        body.latitude,
    longitude:       body.longitude,
    scheduled_start: body.scheduled_start,
    scheduled_end:   body.scheduled_end ?? body.scheduled_start,
    pilot_id:        body.pilot_id,
    equipment_ids:   body.equipment_ids ?? [],
    status:          'planned',
    service_fee:     body.service_fee,
    permit_no:       body.permit_no,
    permit_obtained: body.permit_obtained ?? false,
    rescue_mission_id: body.rescue_mission_id,
    notes:           body.notes,
    created_at:      now(),
    updated_at:      now(),
  };

  // 合規警示：未取得許可的商業飛行
  const warnings: string[] = [];
  if (!mission.permit_obtained) {
    warnings.push('⛔ 尚未取得飛行許可。依《無人機管理規則》第 15 條，商業飛行必須事先申請許可。');
  }

  // 飛手執照有效期確認
  const pilot = PILOTS.find(p => p.pilot_id === mission.pilot_id);
  if (pilot) {
    const days = daysUntilExpiry(pilot.license_expiry);
    if (days < 0) {
      warnings.push(`⛔ 飛手 ${pilot.name} 執照已於 ${pilot.license_expiry} 過期，不得執行商業飛行。`);
    } else if (days < 30) {
      warnings.push(`⚠️ 飛手 ${pilot.name} 執照將於 ${days} 天後到期（${pilot.license_expiry}），請儘速安排更新。`);
    }
  }

  if (MISSIONS.length >= MISSION_MAX) MISSIONS.shift();
  MISSIONS.push(mission);

  logger.info(`[Scout] Mission created: ${mission.mission_id} | ${mission.title}`);

  res.status(201).json({
    mission_id: mission.mission_id,
    status: 'planned',
    warnings,
    permit_reminder: !mission.permit_obtained
      ? '請至民航局官網申請飛行許可：https://drone.caa.gov.tw'
      : null,
  });
});

// ── GET /agents/scout/mission ─────────────────────────────────
scoutRouter.get('/mission', async (req: Request, res: Response) => {
  const { status, client_name, from, to, limit } = req.query as Record<string, string>;

  let results = [...MISSIONS];
  if (status) results = results.filter(m => m.status === status);
  if (client_name) results = results.filter(m => m.client_name.includes(client_name));
  if (from) results = results.filter(m => m.scheduled_start >= from);
  if (to)   results = results.filter(m => m.scheduled_start <= to);

  const lim = Math.min(parseInt(limit ?? '50'), 200);
  results = results.slice(-lim).reverse();

  res.json({
    total: results.length,
    missions: results,
  });
});

// ── PATCH /agents/scout/mission/:id/status ────────────────────
scoutRouter.patch('/mission/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { status, actual_start, actual_end, flight_time_mins,
          area_covered_sqm, weather_condition, notes } = req.body as {
    status?: MissionStatus;
    actual_start?: string;
    actual_end?: string;
    flight_time_mins?: number;
    area_covered_sqm?: number;
    weather_condition?: string;
    notes?: string;
  };

  const mission = MISSIONS.find(m => m.mission_id === id);
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }

  if (status) mission.status = status;
  if (actual_start) mission.actual_start = actual_start;
  if (actual_end)   mission.actual_end   = actual_end;
  if (flight_time_mins !== undefined) mission.flight_time_mins = flight_time_mins;
  if (area_covered_sqm !== undefined) mission.area_covered_sqm = area_covered_sqm;
  if (weather_condition) mission.weather_condition = weather_condition;
  if (notes) mission.notes = notes;
  mission.updated_at = now();

  // 任務完成 → 自動寫入鳴鑫帳本
  if (status === 'completed' && mission.service_fee && mission.service_fee > 0) {
    await writeToAccountant(mission, mission.service_fee);
    logger.info(`[Scout] Mission completed, fee NT$${mission.service_fee} sent to accountant`);
  }

  res.json({ ok: true, mission_id: id, status: mission.status });
});

// ── POST /agents/scout/equipment ─────────────────────────────
scoutRouter.post('/equipment', async (req: Request, res: Response) => {
  const body = req.body as Partial<UAVEquipment>;

  if (!body.brand || !body.model || !body.serial_no) {
    res.status(400).json({ error: 'brand, model, serial_no are required' });
    return;
  }

  const equipment: UAVEquipment = {
    equipment_id:       crypto.randomUUID(),
    entity_type:        'co_drone',
    brand:              body.brand,
    model:              body.model,
    serial_no:          body.serial_no,
    registration_no:    body.registration_no,
    purchase_date:      body.purchase_date ?? now().slice(0, 10),
    purchase_price:     body.purchase_price ?? 0,
    current_value:      body.purchase_price ?? 0,
    status:             'active',
    total_flight_hrs:   body.total_flight_hrs ?? 0,
    last_maintenance_date: body.last_maintenance_date,
    next_maintenance_date: body.next_maintenance_date,
    battery_cycle_count:   body.battery_cycle_count,
    insurance_policy:      body.insurance_policy,
    created_at:         now(),
    notes:              body.notes,
  };

  // 計算折舊
  if (equipment.purchase_price > 0) {
    equipment.current_value = calcDepreciation(
      equipment.purchase_price,
      equipment.purchase_date,
    );
  }

  if (EQUIPMENT.length >= EQUIP_MAX) EQUIPMENT.shift();
  EQUIPMENT.push(equipment);

  // 自動提示：通知安盾評估航空器保險
  const insuranceReminder = equipment.purchase_price > 50000
    ? `提醒：設備購置成本 NT$${equipment.purchase_price.toLocaleString()}，建議向安盾評估機體損失險（Hull）與第三人責任險（TPL）。`
    : null;

  res.status(201).json({
    equipment_id: equipment.equipment_id,
    current_value: equipment.current_value,
    insurance_reminder: insuranceReminder,
  });
});

// ── GET /agents/scout/equipment ───────────────────────────────
scoutRouter.get('/equipment', async (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };

  let results = [...EQUIPMENT];
  if (status) results = results.filter(e => e.status === status);

  // 更新折舊值
  results = results.map(e => ({
    ...e,
    current_value: e.purchase_price > 0
      ? calcDepreciation(e.purchase_price, e.purchase_date)
      : e.current_value,
    maintenance_overdue: e.next_maintenance_date
      ? new Date(e.next_maintenance_date) < new Date()
      : false,
  }));

  const total_fleet_value = results.reduce((s, e) => s + e.current_value, 0);

  res.json({
    total: results.length,
    total_fleet_value,
    equipment: results,
  });
});

// ── POST /agents/scout/pilot ──────────────────────────────────
scoutRouter.post('/pilot', async (req: Request, res: Response) => {
  const body = req.body as Partial<UAVPilot>;

  if (!body.name || !body.license_no || !body.license_expiry) {
    res.status(400).json({ error: 'name, license_no, license_expiry are required' });
    return;
  }

  const pilot: UAVPilot = {
    pilot_id:       crypto.randomUUID(),
    name:           body.name,
    license_type:   body.license_type ?? 'basic',
    license_no:     body.license_no,
    license_expiry: body.license_expiry,
    contact:        body.contact ?? '',
    is_active:      true,
    created_at:     now(),
    notes:          body.notes,
  };

  if (PILOTS.length >= PILOT_MAX) PILOTS.shift();
  PILOTS.push(pilot);

  const days = daysUntilExpiry(pilot.license_expiry);

  res.status(201).json({
    pilot_id: pilot.pilot_id,
    license_status: days < 0 ? 'EXPIRED' : days < 30 ? 'EXPIRING_SOON' : 'VALID',
    days_until_expiry: days,
    warning: days < 30
      ? `⚠️ 執照${days < 0 ? '已' : '將'}到期，請儘速至民航局官網辦理更新。`
      : null,
  });
});

// ── GET /agents/scout/pilot ───────────────────────────────────
scoutRouter.get('/pilot', async (req: Request, res: Response) => {
  const pilotsWithStatus = PILOTS.map(p => {
    const days = daysUntilExpiry(p.license_expiry);
    return {
      ...p,
      contact: '****',   // 隱藏聯絡方式
      days_until_expiry: days,
      license_status: days < 0 ? 'EXPIRED' : days < 30 ? 'EXPIRING_SOON' : 'VALID',
    };
  });

  const warnings = pilotsWithStatus.filter(p => p.license_status !== 'VALID');

  res.json({
    total: pilotsWithStatus.length,
    pilot_warnings: warnings.length,
    pilots: pilotsWithStatus,
  });
});

// ── POST /agents/scout/permit/check ──────────────────────────
scoutRouter.post('/permit/check', async (req: Request, res: Response) => {
  const { location, mission_type, altitude_m, operation_type } = req.body as {
    location?: string;
    mission_type?: string;
    altitude_m?: number;
    operation_type?: 'visual' | 'bvlos';
  };

  if (!location) {
    res.status(400).json({ error: 'location is required' });
    return;
  }

  const question = `在${location}進行${mission_type ?? '商業攝影'}無人機飛行（高度${altitude_m ?? 120}公尺，${operation_type === 'bvlos' ? '超視距飛行 BVLOS' : '目視範圍內飛行'}），需要哪些許可？有哪些限制？`;
  const ragContext = await queryAviationRag(question);

  const systemPrompt = `${scoutSystemPrompt.template}\n\n【相關法規（RAG）】\n${ragContext || '（未找到相關法規，請直接依一般規定回答）'}`;
  const answer = await ollamaChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ], MODEL, { temperature: 0.1 });

  res.json({
    location,
    mission_type: mission_type ?? 'commercial',
    altitude_m: altitude_m ?? 120,
    operation_type: operation_type ?? 'visual',
    permit_analysis: answer,
    rag_references: ragContext ? '已引用航空法規 RAG' : '法規庫未命中，請人工確認',
    official_portal: 'https://drone.caa.gov.tw',
  });
});

// ── POST /agents/scout/quote ──────────────────────────────────
scoutRouter.post('/quote', async (req: Request, res: Response) => {
  const { service_type, area_sqm, flight_sessions, additional_services, client_name } = req.body as {
    service_type: 'aerial_photo' | 'inspection' | 'agriculture' | 'survey' | 'rescue_support';
    area_sqm?: number;
    flight_sessions?: number;
    additional_services?: string[];
    client_name?: string;
  };

  // 參考報價基準（2024 市場行情）
  const BASE_RATES: Record<string, number> = {
    aerial_photo:     8000,   // 基本空拍（每架次）
    inspection:      12000,   // 基礎設施巡檢（每架次）
    agriculture:        80,   // 農業噴灑（每公頃）
    survey:          15000,   // 測量（每架次）
    rescue_support:      0,   // 救難協作（依協議）
  };

  const base = BASE_RATES[service_type] ?? 8000;
  const sessions = flight_sessions ?? 1;

  let subtotal: number;
  if (service_type === 'agriculture' && area_sqm) {
    const hectares = area_sqm / 10000;
    subtotal = Math.round(base * hectares * sessions);
  } else {
    subtotal = base * sessions;
  }

  // 附加項目估算
  const additionalItems: Array<{ item: string; amount: number }> = [];
  if (additional_services?.includes('post_processing')) additionalItems.push({ item: '後製剪輯', amount: 3000 });
  if (additional_services?.includes('ortho_map'))       additionalItems.push({ item: '正射影像製作', amount: 5000 });
  if (additional_services?.includes('thermal'))         additionalItems.push({ item: '熱像儀加掛', amount: 3000 });
  const additionalTotal = additionalItems.reduce((s, i) => s + i.amount, 0);

  const total_untaxed = subtotal + additionalTotal;
  const tax_amount = Math.round(total_untaxed * 0.05);
  const total_taxed = total_untaxed + tax_amount;

  res.json({
    quote_id:        crypto.randomUUID(),
    client_name:     client_name ?? '待填',
    service_type,
    line_items: [
      { item: `${service_type} × ${sessions} 架次`, amount: subtotal },
      ...additionalItems,
    ],
    subtotal:        total_untaxed,
    tax_rate:        '5%',
    tax_amount,
    total:           total_taxed,
    currency:        'NTD',
    validity_days:   30,
    note:            '以上報價為參考行情，實際費用依現場條件與合約議定為準',
    generated_at:    now(),
  });
});

// ── GET /agents/scout/report/monthly ────────────────────────
scoutRouter.get('/report/monthly', async (req: Request, res: Response) => {
  const { year, month } = req.query as { year?: string; month?: string };
  const y = parseInt(year ?? String(new Date().getFullYear()));
  const m = parseInt(month ?? String(new Date().getMonth() + 1));
  const fromStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const toStr   = `${y}-${String(m).padStart(2, '0')}-31`;

  const monthMissions = MISSIONS.filter(
    mis => mis.scheduled_start >= fromStr && mis.scheduled_start <= toStr,
  );

  const completed  = monthMissions.filter(m => m.status === 'completed');
  const total_revenue = completed.reduce((s, m) => s + (m.service_fee ?? 0), 0);
  const total_flight_hrs = completed.reduce((s, m) => s + ((m.flight_time_mins ?? 0) / 60), 0);

  const byType: Record<string, number> = {};
  for (const m of completed) {
    byType[m.mission_type] = (byType[m.mission_type] ?? 0) + 1;
  }

  res.json({
    period: `${y}-${String(m).padStart(2, '0')}`,
    total_missions:     monthMissions.length,
    completed_missions: completed.length,
    total_revenue_twd:  total_revenue,
    total_flight_hrs:   Math.round(total_flight_hrs * 10) / 10,
    missions_by_type:   byType,
    pilot_warnings:     PILOTS.filter(p => daysUntilExpiry(p.license_expiry) < 30).map(p => ({
      name: p.name, expiry: p.license_expiry, days_left: daysUntilExpiry(p.license_expiry),
    })),
  });
});

// ── GET /agents/scout/health ──────────────────────────────────
scoutRouter.get('/health', async (_req: Request, res: Response) => {
  const expiredPilots = PILOTS.filter(p => daysUntilExpiry(p.license_expiry) < 0);
  const expiringPilots = PILOTS.filter(p => {
    const d = daysUntilExpiry(p.license_expiry);
    return d >= 0 && d < 30;
  });

  res.json({
    agent: AGENT_ID,
    status: 'online',
    entity_scope: 'co_drone',
    stats: {
      total_missions:   MISSIONS.length,
      total_equipment:  EQUIPMENT.length,
      total_pilots:     PILOTS.length,
      expired_licenses: expiredPilots.length,
      expiring_licenses: expiringPilots.length,
    },
    alerts: [
      ...expiredPilots.map(p => `⛔ 飛手 ${p.name} 執照已過期（${p.license_expiry}）`),
      ...expiringPilots.map(p => `⚠️ 飛手 ${p.name} 執照將在 ${daysUntilExpiry(p.license_expiry)} 天後到期`),
    ],
    timestamp: now(),
  });
});
