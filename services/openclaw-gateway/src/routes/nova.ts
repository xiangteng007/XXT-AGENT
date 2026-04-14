/**
 * Nova Agent Route — 天璣 🔮 人事管理幕僚 (E-1)
 *
 * POST /agents/nova/chat          — AI 人事問答（勞基法/薪資/合規）
 * POST /agents/nova/employee      — 新增員工
 * GET  /agents/nova/employees     — 查詢員工列表
 * GET  /agents/nova/employee/:id  — 取得員工詳細資料
 * PATCH /agents/nova/employee/:id — 更新員工（薪資/狀態/眷口）
 * POST /agents/nova/payroll       — 計算並記錄月薪資
 * GET  /agents/nova/payroll       — 查詢薪資記錄
 * GET  /agents/nova/leave/:id     — 計算員工特休天數
 * GET  /agents/nova/health        — Agent 狀態
 *
 * 設計原則：
 *   - 人事資料屬 PRIVATE，強制本地 Ollama
 *   - 勞基法合規自動查詢 Regulation RAG (labor 類別)
 *   - 薪資發放後自動 dispatch 至 Accountant（跨 Agent 協作）
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { ollamaChat } from '../ollama-inference.service';
import { novaSystemPrompt } from '../prompts';
import {
  addEmployee, updateEmployee, getEmployee, queryEmployees,
  addPayroll, queryPayrolls, linkPayrollToLedger, dispatchPayrollToLedger,
  calcTenureMonths, calcAnnualLeave, calcOvertimePay, maskIdNo,
  type Employee, type PayrollRecord, type EntityType, type EmploymentStatus, type PayrollOvertimeItem,
} from '../nova-store';

export const novaRouter = Router();

const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const AGENT_ID = 'nova';
const MODEL    = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';

// ── RAG 輔助（勞基法查詢）────────────────────────────────────
async function queryLaborRag(question: string): Promise<string> {
  try {
    const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, category: 'labor', top_k: 3 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return '';
    const data = await resp.json() as { results?: Array<{ content: string; source: string }> };
    return (data.results ?? []).map(r => `【${r.source}】\n${r.content}`).join('\n\n---\n\n');
  } catch { return ''; }
}

/**
 * @openapi
 * /agents/nova/chat:
 *   post:
 *     tags: [Nova]
 *     summary: Nova 人事 AI 問答
 *     description: |
 *       人事管理問答（勞基法合規、薪資試算、特休計算）。
 *       強制本地 Ollama（PRIVATE），勞工法規問題自動查詢 Regulation RAG。
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentChatRequest'
 *           example:
 *             message: "員工年資 3 年 2 個月，特休幾天？"
 *     responses:
 *       200:
 *         description: AI 回答
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentChatResponse'
 */
novaRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, context, session_id } = req.body as {
    message?: string; context?: string; session_id?: string;
  };
  if (!message?.trim()) { res.status(400).json({ error: 'message is required' }); return; }

  const traceId = crypto.randomUUID();

  // 勞基法關鍵字 → 查 RAG
  const laborKeywords = ['特休', '加班', '薪資', '勞保', '健保', '勞退', '資遣', '退職', '工時', '假日', '職災', '勞基法', '最低工資', '基本工資'];
  const needsRag = laborKeywords.some(k => message.includes(k));
  const ragContext = needsRag ? await queryLaborRag(message) : '';

  const userContent = ragContext
    ? `【相關勞工法規（自動擷取）】\n${ragContext}\n\n---\n\n【問題】${message}${context ? `\n\n【背景】${context}` : ''}`
    : `${message}${context ? `\n\n【背景】${context}` : ''}`;

  try {
    const { content: reply, latency_ms } = await ollamaChat(
      [{ role: 'system', content: novaSystemPrompt.template }, { role: 'user', content: userContent }],
      MODEL, { temperature: 0.15, num_predict: 2048 },
    );
    logger.info(`[Nova/chat] trace=${traceId} latency=${latency_ms}ms rag=${needsRag}`);
    res.json({ agent_id: AGENT_ID, model: MODEL, inference_route: 'local', privacy_level: 'PRIVATE', rag_used: needsRag ? 'labor' : null, trace_id: traceId, latency_ms, reply });
  } catch (err) {
    res.status(503).json({ error: 'Nova agent unavailable', detail: String(err) });
  }
});

/**
 * @openapi
 * /agents/nova/employee:
 *   post:
 *     tags: [Nova]
 *     summary: 新增員工
 *     description: 建立員工基本資料，包含勞保/健保投保薪資設定
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, id_no, hire_date, base_salary, position, entity_type]
 *             properties:
 *               name:             { type: string, example: 陳大明 }
 *               id_no:            { type: string, description: 身分證字號（儲存時自動遮罩） }
 *               hire_date:        { type: string, format: date, example: '2024-03-01' }
 *               base_salary:      { type: number, example: 45000 }
 *               position:         { type: string, example: 工地主任 }
 *               entity_type:      { type: string, enum: [co_construction, co_renovation, co_design, co_drone] }
 *               employment_type:  { type: string, enum: [full_time, part_time, contractor], default: full_time }
 *               labor_insurance_bracket: { type: number, example: 45800 }
 *               health_insurance_bracket: { type: number, example: 46800 }
 *               health_dependents:{ type: integer, default: 0 }
 *               pension_self_rate:{ type: number, default: 0 }
 *     responses:
 *       201:
 *         description: 員工建立成功
 */
novaRouter.post('/employee', async (req: Request, res: Response) => {
  const b = req.body as {
    name?: string; id_no?: string; hire_date?: string;
    base_salary?: number; position?: string;
    entity_type?: EntityType; employment_type?: string;
    labor_insurance_bracket?: number; health_insurance_bracket?: number;
    health_dependents?: number; pension_self_rate?: number;
    phone?: string; bank_account?: string; birthday?: string; notes?: string;
    company_id?: string; created_by?: string;
  };

  if (!b.name || !b.id_no || !b.hire_date || !b.base_salary || !b.position || !b.entity_type) {
    res.status(400).json({ error: 'name, id_no, hire_date, base_salary, position, entity_type required' });
    return;
  }

  const baseSalary = Math.round(b.base_salary);
  const laborBracket = b.labor_insurance_bracket ?? baseSalary;
  const healthBracket = b.health_insurance_bracket ?? baseSalary;

  const emp: Employee = {
    employee_id: crypto.randomUUID(),
    company_id: b.company_id ?? 'senteng',
    entity_type: b.entity_type,
    name: b.name,
    id_no_masked: maskIdNo(b.id_no),
    birthday: b.birthday,
    hire_date: b.hire_date,
    status: 'active',
    base_salary: baseSalary,
    position: b.position,
    employment_type: (b.employment_type as Employee['employment_type']) ?? 'full_time',
    labor_insurance_bracket: laborBracket,
    health_insurance_bracket: healthBracket,
    health_dependents: b.health_dependents ?? 0,
    pension_self_rate: b.pension_self_rate ?? 0,
    phone: b.phone,
    bank_account: b.bank_account,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: b.created_by ?? 'nova-bot',
    notes: b.notes,
  };

  await addEmployee(emp);
  const tenure = calcTenureMonths(emp.hire_date);
  const annualLeave = calcAnnualLeave(tenure);

  res.status(201).json({
    ok: true, employee_id: emp.employee_id,
    summary: { name: emp.name, position: emp.position, hire_date: emp.hire_date, base_salary: baseSalary, entity_type: emp.entity_type, status: 'active', tenure_months: tenure, annual_leave_days: annualLeave },
    message: `員工「${emp.name}」已建檔，年資 ${Math.floor(tenure/12)} 年 ${tenure%12} 月，法定特休 ${annualLeave} 天。`,
  });
});

// ── GET /agents/nova/employees ────────────────────────────────
novaRouter.get('/employees', async (req: Request, res: Response) => {
  const { entity_type, status, limit } = req.query as Record<string, string | undefined>;
  const validEntities: EntityType[] = ['co_construction', 'co_renovation', 'co_design', 'co_drone'];
  const employees = await queryEmployees({
    entity_type: validEntities.includes(entity_type as EntityType) ? entity_type as EntityType : undefined,
    status: (['active','inactive','on_leave'].includes(status ?? '')) ? status as EmploymentStatus : undefined,
    limit: limit ? parseInt(limit) : 50,
  });
  res.json({
    count: employees.length,
    employees: employees.map(e => ({
      employee_id: e.employee_id, name: e.name, position: e.position,
      entity_type: e.entity_type, status: e.status, hire_date: e.hire_date,
      base_salary: e.base_salary,
      tenure_months: calcTenureMonths(e.hire_date, e.resign_date),
      annual_leave_days: calcAnnualLeave(calcTenureMonths(e.hire_date, e.resign_date)),
    })),
  });
});

// ── GET /agents/nova/employee/:id ─────────────────────────────
novaRouter.get('/employee/:id', async (req: Request, res: Response) => {
  const emp = await getEmployee(req.params['id'] ?? '');
  if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }
  const tenure = calcTenureMonths(emp.hire_date, emp.resign_date);
  res.json({ ...emp, tenure_months: tenure, annual_leave_days: calcAnnualLeave(tenure) });
});

// ── PATCH /agents/nova/employee/:id ──────────────────────────
novaRouter.patch('/employee/:id', async (req: Request, res: Response) => {
  const allowedFields = ['base_salary','position','status','resign_date','health_dependents','pension_self_rate','labor_insurance_bracket','health_insurance_bracket','notes','phone','bank_account'];
  const updates: Partial<Employee> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) (updates as Record<string,unknown>)[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
  await updateEmployee(req.params['id'] ?? '', updates);
  res.json({ ok: true, updated_fields: Object.keys(updates) });
});

// ── GET /agents/nova/leave/:id ── 特休試算 ───────────────────
novaRouter.get('/leave/:id', async (req: Request, res: Response) => {
  const emp = await getEmployee(req.params['id'] ?? '');
  if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }
  const tenure = calcTenureMonths(emp.hire_date);
  const leave = calcAnnualLeave(tenure);
  res.json({
    employee_id: emp.employee_id, name: emp.name,
    hire_date: emp.hire_date, today: new Date().toISOString().slice(0,10),
    tenure_months: tenure, tenure_years: `${Math.floor(tenure/12)}年${tenure%12}個月`,
    annual_leave_days: leave,
    legal_basis: '依《勞動基準法》第 38 條（特別休假天數），2024 年版',
    note: '特休未休完之工資依第 38 條第 4 項規定，應於年度終結或契約終止時以工資補發。',
  });
});

/**
 * @openapi
 * /agents/nova/payroll:
 *   post:
 *     tags: [Nova]
 *     summary: 計算並記錄月薪資
 *     description: |
 *       計算員工月薪（含加班費），記入 payroll_records，
 *       並自動 dispatch 至 Accountant 記入費用帳本（labor）。
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [employee_id, period, pay_date]
 *             properties:
 *               employee_id: { type: string, format: uuid }
 *               period:      { type: string, example: "202605" }
 *               pay_date:    { type: string, format: date, example: "2026-06-05" }
 *               overtime_items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:  { type: string, format: date }
 *                     hours: { type: number }
 *                     type:  { type: string, enum: [weekday, holiday] }
 *               full_attendance_bonus: { type: number, default: 0 }
 *               other_additions:       { type: number, default: 0 }
 *               other_deductions:      { type: number, default: 0 }
 *               dispatch_to_accountant: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: 薪資記錄建立，費用帳本已 dispatch
 */
novaRouter.post('/payroll', async (req: Request, res: Response) => {
  const {
    employee_id, period, pay_date,
    overtime_items = [],
    full_attendance_bonus = 0,
    other_additions = 0,
    other_deductions = 0,
    dispatch_to_accountant = true,
    created_by,
    notes,
  } = req.body as {
    employee_id?: string; period?: string; pay_date?: string;
    overtime_items?: PayrollOvertimeItem[];
    full_attendance_bonus?: number; other_additions?: number; other_deductions?: number;
    dispatch_to_accountant?: boolean; created_by?: string; notes?: string;
  };

  if (!employee_id || !period || !pay_date) {
    res.status(400).json({ error: 'employee_id, period, pay_date required' }); return;
  }

  const emp = await getEmployee(employee_id);
  if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }
  if (emp.status !== 'active') { res.status(400).json({ error: `Employee is ${emp.status}` }); return; }

  // ── 費率常數 (2024) ───────────────────────────────────────
  const LABOR_EMP_RATE    = 0.012;     // 勞保員工自付率
  const LABOR_EMPLOYER_RATE = 0.09;    // 勞保雇主負擔率
  const HEALTH_EMP_RATE   = 0.0211;    // 健保員工自付率（基礎，不含眷口）
  const HEALTH_EMP_DEP_RATE = 0.0211;  // 每增一口眷屬費率
  const HEALTH_EMPLOYER_RATE = 0.0611; // 健保雇主負擔率
  const PENSION_EMPLOYER_RATE = 0.06;  // 勞退雇主強制提撥率

  const hourlyRate = emp.base_salary / 240;  // 月薪÷240（月工時）

  // 計算各項費用
  const overtimePay = calcOvertimePay(hourlyRate, overtime_items);

  const grossSalary = emp.base_salary + overtimePay + full_attendance_bonus + other_additions;

  const laborEmp    = Math.round(emp.labor_insurance_bracket * LABOR_EMP_RATE);
  const healthEmp   = Math.round(emp.health_insurance_bracket * HEALTH_EMP_RATE +
                                  emp.health_insurance_bracket * HEALTH_EMP_DEP_RATE * emp.health_dependents);
  const withholdTax = 0;   // 簡化：預扣所得稅需依扶養人數查扣繳稅額表

  const netSalary = grossSalary - laborEmp - healthEmp - withholdTax - other_deductions;

  const laborEmployer   = Math.round(emp.labor_insurance_bracket * LABOR_EMPLOYER_RATE);
  const healthEmployer  = Math.round(emp.health_insurance_bracket * HEALTH_EMPLOYER_RATE);
  const pensionEmployer = Math.round(emp.base_salary * PENSION_EMPLOYER_RATE);

  const record: PayrollRecord = {
    payroll_id: crypto.randomUUID(),
    employee_id, company_id: emp.company_id, entity_type: emp.entity_type,
    period, pay_date,
    base_salary: emp.base_salary, overtime_pay: overtimePay,
    full_attendance_bonus, other_additions, other_deductions,
    labor_insurance_employee: laborEmp, health_insurance_employee: healthEmp,
    withholding_tax: withholdTax,
    gross_salary: grossSalary, net_salary: netSalary,
    employer_labor_insurance: laborEmployer, employer_health_insurance: healthEmployer,
    employer_pension: pensionEmployer,
    overtime_items,
    created_at: new Date().toISOString(),
    created_by: created_by ?? 'nova-bot',
    notes,
  };

  await addPayroll(record);

  // 跨 Agent: dispatch 至 Accountant
  let ledgerDispatched = false;
  if (dispatch_to_accountant) {
    const { queued } = await dispatchPayrollToLedger(record, emp.name);
    ledgerDispatched = queued;
  }

  res.status(201).json({
    ok: true, payroll_id: record.payroll_id,
    summary: {
      employee: emp.name, period, pay_date,
      payroll: {
        base_salary: emp.base_salary, overtime_pay: overtimePay,
        full_attendance_bonus, other_additions,
        gross_salary: grossSalary,
        deductions: { labor_insurance: laborEmp, health_insurance: healthEmp, withholding_tax: withholdTax, other: other_deductions },
        net_salary: netSalary,
      },
      employer_cost: { labor: laborEmployer, health: healthEmployer, pension: pensionEmployer, total: laborEmployer + healthEmployer + pensionEmployer },
      cross_agent: { accountant_dispatch: ledgerDispatched },
    },
    message: `${emp.name} ${period} 月薪計算完成，實發 NT$${netSalary.toLocaleString()}。${ledgerDispatched ? '費用帳本已 dispatch 至 Accountant。' : ''}`,
  });
});

// ── GET /agents/nova/payroll ──────────────────────────────────
novaRouter.get('/payroll', async (req: Request, res: Response) => {
  const { employee_id, period, year, entity_type, limit } = req.query as Record<string, string | undefined>;
  const validEntities: EntityType[] = ['co_construction', 'co_renovation', 'co_design', 'co_drone'];
  const records = await queryPayrolls({
    employee_id, period,
    year: year ? parseInt(year) : undefined,
    entity_type: validEntities.includes(entity_type as EntityType) ? entity_type as EntityType : undefined,
    limit: limit ? parseInt(limit) : 50,
  });
  const totalNetSalary = records.reduce((s, r) => s + r.net_salary, 0);
  const totalEmployerCost = records.reduce((s, r) => s + r.employer_labor_insurance + r.employer_health_insurance + r.employer_pension, 0);
  res.json({ count: records.length, total_net_salary: totalNetSalary, total_employer_cost: totalEmployerCost, records });
});

// ── GET /agents/nova/health ───────────────────────────────────
novaRouter.get('/health', async (_req: Request, res: Response) => {
  let ragStatus = 'unknown';
  try { const r = await fetch(`${REGULATION_RAG_URL}/health`, { signal: AbortSignal.timeout(3000) }); ragStatus = r.ok ? 'online' : 'degraded'; }
  catch { ragStatus = 'offline'; }
  res.json({
    agent_id: AGENT_ID, display_name: 'Nova ✨ (HR)',
    status: 'ready', model: MODEL, inference_route: 'local', privacy_level: 'PRIVATE',
    rag_status: ragStatus, rag_categories: ['labor'],
    capabilities: ['chat', 'employee_crud', 'payroll_calculate', 'leave_calc', 'cross_agent_accountant'],
    version: '1.0.0',
  });
});
