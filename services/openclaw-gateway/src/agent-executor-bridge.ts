/**
 * agent-executor-bridge.ts — AOP Agent Executor Registration (v9.0)
 *
 * 將 Gateway 內所有 Agent 路由連接到 AOP 協調引擎。
 * 每個 Agent 的 executor 透過內部 HTTP 請求轉發動作至對應路由。
 *
 * 支援動作：
 *   - CHAT: 自由問答
 *   - FETCH_DATA / QUERY: 查詢資料
 *   - CREATE / UPDATE: 資料寫入
 *   - ANALYZE: AI 分析
 *   - DISPATCH_PAYROLL: Nova 薪資計算 → Accountant
 *   - RECONCILE: 對帳任務
 *
 * 啟動時機：Gateway 初始化後呼叫 `registerAllExecutors()`
 */

import { orchestrationService, type AgentExecutor } from './agent-orchestration.service';
import { logger } from './logger';

const GATEWAY_BASE = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3100';
const AUTH_TOKEN   = process.env['OPENCLAW_API_KEY'] ?? 'dev-secret-key';

// ── 通用 HTTP 請求轉發器 ──────────────────────────────────────

interface RouteConfig {
  /** Agent 路由前綴（例如 '/agents/lex'） */
  basePath: string;
  /** 動作 → HTTP 方法 + 路徑的映射 */
  actions: Record<string, { method: 'GET' | 'POST' | 'PATCH'; path: string }>;
}

async function internalRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  timeoutMs: number = 30000,
): Promise<unknown> {
  const url = `${GATEWAY_BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'X-AOP-Internal': 'true',
      },
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }

    return await resp.json().catch(() => null);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Agent 路由配置 ───────────────────────────────────────────────

const AGENT_ROUTES: Record<string, RouteConfig> = {
  lex: {
    basePath: '/agents/lex',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
      CREATE_CONTRACT:   { method: 'POST', path: '/contract' },
      LIST_CONTRACTS:    { method: 'GET',  path: '/contract' },
      CHECK_EXPIRING:    { method: 'GET',  path: '/contract/expiring' },
      LIST_MILESTONES:   { method: 'GET',  path: '/contract/milestones' },
      ANALYZE_CONTRACT:  { method: 'POST', path: '/contract/{id}/analyze' },
      CREATE_DOCUMENT:   { method: 'POST', path: '/document' },
      CHECK_DOC_EXPIRY:  { method: 'GET',  path: '/document/expiring' },
    },
  },
  accountant: {
    basePath: '/agents/accountant',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
      CREATE_LEDGER:     { method: 'POST', path: '/ledger' },
      QUERY_LEDGER:      { method: 'GET',  path: '/ledger' },
      GENERATE_REPORT:   { method: 'GET',  path: '/report/vat401' },
    },
  },
  nova: {
    basePath: '/agents/nova',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
      CREATE_EMPLOYEE:   { method: 'POST', path: '/employee' },
      LIST_EMPLOYEES:    { method: 'GET',  path: '/employees' },
      CALCULATE_PAYROLL: { method: 'POST', path: '/payroll' },
      QUERY_PAYROLL:     { method: 'GET',  path: '/payroll' },
      CALC_LEAVE:        { method: 'GET',  path: '/leave/{id}' },
    },
  },
  guardian: {
    basePath: '/agents/guardian',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
      CREATE_POLICY:     { method: 'POST', path: '/policy' },
      LIST_POLICIES:     { method: 'GET',  path: '/policy' },
    },
  },
  finance: {
    basePath: '/agents/finance',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
      QUERY_POSITION:    { method: 'GET',  path: '/position' },
    },
  },
  bim: {
    basePath: '/agents/bim',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
    },
  },
  interior: {
    basePath: '/agents/interior',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
    },
  },
  estimator: {
    basePath: '/agents/estimator',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
    },
  },
  scout: {
    basePath: '/agents/scout',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
    },
  },
  zora: {
    basePath: '/agents/zora',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
    },
  },
  sage: {
    basePath: '/agents/sage',
    actions: {
      CHAT:              { method: 'POST', path: '/chat' },
    },
  },
};

// ── 通用 Executor 生成器 ─────────────────────────────────────────

function createAgentExecutor(agentId: string, config: RouteConfig): AgentExecutor {
  return async (action, payload, context) => {
    const actionConfig = config.actions[action];

    if (!actionConfig) {
      // Fallback: 未定義的動作統一走 /chat
      logger.info(`[AEB] Agent ${agentId}: unknown action "${action}", falling back to CHAT`);
      const chatResult = await internalRequest('POST', `${config.basePath}/chat`, {
        message: payload['message'] ?? `Execute action: ${action}`,
        session_id: context.workflowId,
        ...payload,
      });
      return chatResult;
    }

    // 處理路徑參數（例如 {id}）
    let path = `${config.basePath}${actionConfig.path}`;
    const pathParams = path.match(/\{(\w+)\}/g);
    if (pathParams) {
      for (const param of pathParams) {
        const key = param.slice(1, -1);
        const value = payload[key];
        if (value !== undefined) {
          path = path.replace(param, String(value));
          // 從 payload 移除路徑參數（避免在 body 中重複）
          const cleanPayload = { ...payload };
          delete cleanPayload[key];
          // eslint-disable-next-line no-param-reassign
          payload = cleanPayload as Record<string, unknown>;
        }
      }
    }

    // 對 GET 請求，將 payload 轉為 query string
    if (actionConfig.method === 'GET') {
      const queryEntries = Object.entries(payload)
        .filter(([k]) => k !== '_previousResults')
        .filter(([, v]) => v !== undefined && v !== null);

      if (queryEntries.length > 0) {
        const params = new URLSearchParams();
        for (const [k, v] of queryEntries) {
          params.set(k, String(v));
        }
        path += `?${params.toString()}`;
      }
      return await internalRequest('GET', path);
    }

    // POST / PATCH — 清除內部元資料
    const { _previousResults, ...cleanPayload } = payload;
    return await internalRequest(actionConfig.method, path, cleanPayload);
  };
}

// ── 預建工作流程模板 ─────────────────────────────────────────────

export const WORKFLOW_TEMPLATES = {
  /**
   * Lex → Accountant 合約里程碑對帳流程
   *
   * 步驟：
   * 1. Lex 查詢所有未付里程碑
   * 2. Accountant 查詢帳本（比對）
   * 3. Lex AI 生成對帳報告
   */
  CONTRACT_RECONCILIATION: {
    name: '合約請款對帳工作流',
    steps: [
      {
        id: 'fetch-milestones',
        agentId: 'lex',
        action: 'LIST_MILESTONES',
        payload: {},
      },
      {
        id: 'fetch-ledger',
        agentId: 'accountant',
        action: 'QUERY_LEDGER',
        payload: { category: 'engineering_payment' },
      },
      {
        id: 'reconcile-report',
        agentId: 'lex',
        action: 'CHAT',
        payload: {
          message: '請依據前述步驟取得的合約里程碑與帳本資料，生成對帳報告。' +
                   '標示已入帳、未入帳、金額差異等項目，格式化為表格。',
        },
        dependsOn: ['fetch-milestones', 'fetch-ledger'],
      },
    ],
  },

  /**
   * Nova 全員薪資計算工作流
   *
   * 步驟：
   * 1. Nova 查詢所有在職員工
   * 2. Nova 按批次計算薪資（自動 dispatch 至 Accountant）
   */
  BATCH_PAYROLL: {
    name: '全員月薪計算工作流',
    steps: [
      {
        id: 'list-active-employees',
        agentId: 'nova',
        action: 'LIST_EMPLOYEES',
        payload: { status: 'active', limit: '200' },
      },
      {
        id: 'report-summary',
        agentId: 'nova',
        action: 'CHAT',
        payload: {
          message: '請依據前述步驟取得的在職員工清單，整理出月薪計算所需的摘要報告，' +
                   '包含各法人實體員工人數、薪資級距分布。',
        },
        dependsOn: ['list-active-employees'],
      },
    ],
  },

  /**
   * 合約到期預警 + 文件到期預警 綜合報告
   *
   * 步驟：
   * 1. Lex 檢查即將到期合約
   * 2. Lex 檢查即將到期文件
   * 3. Guardian 查詢相關保單狀態
   * 4. Lex AI 合併生成綜合預警報告
   */
  EXPIRY_ALERT_REPORT: {
    name: '到期預警綜合報告',
    steps: [
      {
        id: 'check-contracts',
        agentId: 'lex',
        action: 'CHECK_EXPIRING',
        payload: { within_days: '60' },
      },
      {
        id: 'check-documents',
        agentId: 'lex',
        action: 'CHECK_DOC_EXPIRY',
        payload: { within_days: '60' },
      },
      {
        id: 'check-insurance',
        agentId: 'guardian',
        action: 'LIST_POLICIES',
        payload: {},
      },
      {
        id: 'compile-alert',
        agentId: 'lex',
        action: 'CHAT',
        payload: {
          message: '請依據前述步驟取得的即將到期合約、文件、保單資料，' +
                   '生成一份綜合到期預警報告，依急迫度排序，標註需採取的行動。',
        },
        dependsOn: ['check-contracts', 'check-documents', 'check-insurance'],
      },
    ],
  },

  /**
   * Nova → Multi-Agent 任務分派
   *
   * Nova 作為 HR 指揮官，查詢員工狀態後
   * 分派任務給 BIM (工程) 和 Estimator (估價)
   */
  NOVA_TASK_DISPATCH: {
    name: 'Nova 多代理人任務分派',
    steps: [
      {
        id: 'check-team-status',
        agentId: 'nova',
        action: 'LIST_EMPLOYEES',
        payload: { status: 'active', limit: '50' },
      },
      {
        id: 'bim-analysis',
        agentId: 'bim',
        action: 'CHAT',
        payload: {
          message: '請列出目前進行中的所有工程專案的 BIM 模型狀態摘要。',
        },
        dependsOn: ['check-team-status'],
      },
      {
        id: 'estimator-review',
        agentId: 'estimator',
        action: 'CHAT',
        payload: {
          message: '請彙整目前待估價或進行中的工料估算任務清單。',
        },
        dependsOn: ['check-team-status'],
      },
      {
        id: 'compile-dispatch',
        agentId: 'nova',
        action: 'CHAT',
        payload: {
          message: '請依據上述各部門的回報，編寫一份跨部門任務分派建議報告。' +
                   '含人力配置建議、優先順序建議、風險提示。',
        },
        dependsOn: ['bim-analysis', 'estimator-review'],
      },
    ],
  },
} as const;

// ── 註冊所有 Agent Executor ──────────────────────────────────────

export function registerAllExecutors(): void {
  let registered = 0;

  for (const [agentId, config] of Object.entries(AGENT_ROUTES)) {
    const executor = createAgentExecutor(agentId, config);
    orchestrationService.registerAgentExecutor(agentId, executor);
    registered++;
  }

  logger.info(`[AEB] ✅ Registered ${registered} agent executors for AOP orchestration`);
  logger.info(`[AEB] Available workflow templates: ${Object.keys(WORKFLOW_TEMPLATES).join(', ')}`);
}
