// ============================================================
// OpenClaw Contracts — PR-1
// 加入 packages/types/src/openclaw.ts
// 在 index.ts 中 re-export 此檔案
// ============================================================

// ────────────────────────────────────────────────────────────
// § 1  EventType 列舉（所有 OpenClaw 事件的單一來源）
// ────────────────────────────────────────────────────────────

export enum EventType {
  // ── Task 生命週期 ──────────────────────────────────────────
  TASK_QUEUED       = "TASK_QUEUED",
  TASK_RUNNING      = "TASK_RUNNING",
  TASK_DONE         = "TASK_DONE",
  TASK_FAILED       = "TASK_FAILED",

  // ── Execution Plane 資料流 ────────────────────────────────
  FUSION_PULSE      = "FUSION_PULSE",
  NEWS_INGESTED     = "NEWS_INGESTED",
  STREAM_PULSE      = "STREAM_PULSE",
  SOCIAL_PULSE      = "SOCIAL_PULSE",
  CACHE_REFRESH     = "CACHE_REFRESH",

  // ── Agent 決策 ────────────────────────────────────────────
  DECISION_READY     = "DECISION_READY",

  // ── Deliberation（討論）── ────────────────────────────────
  DELIBERATION_OPINION     = "DELIBERATION_OPINION",
  DELIBERATION_ARBITRATION = "DELIBERATION_ARBITRATION",

  // ── Local Runner 狀態 ─────────────────────────────────────
  LOCAL_RUNNER_ONLINE        = "LOCAL_RUNNER_ONLINE",
  LOCAL_RUNNER_OFFLINE       = "LOCAL_RUNNER_OFFLINE",
  LOCAL_RUNNER_UNCONFIGURED  = "LOCAL_RUNNER_UNCONFIGURED",

  // ── Scribe 內容 ───────────────────────────────────────────
  CONTENT_DRAFTED   = "CONTENT_DRAFTED",
  CONTENT_FINALIZED = "CONTENT_FINALIZED",

  // ── P2-03: Investment Brain 事件 ──────────────────────────
  INVESTMENT_ANALYSIS_START    = "INVESTMENT_ANALYSIS_START",
  INVESTMENT_ANALYSIS_PROGRESS = "INVESTMENT_ANALYSIS_PROGRESS",  // F-06: SSE node-level progress
  INVESTMENT_ANALYSIS_COMPLETE = "INVESTMENT_ANALYSIS_COMPLETE",
}

// ────────────────────────────────────────────────────────────
// § 2  EventType → Office 動畫 Mapping 表
//      key:   EventType
//      value: { targetAgent, animation, bubbleText? }
// ────────────────────────────────────────────────────────────

export type AgentAnimation =
  | "idle"
  | "working"          // 打字動畫
  | "thinking"         // 思考泡泡 (…)
  | "talking"          // 對話泡泡輪替
  | "roaming"          // 走路移動
  | "celebrating"      // 放鬆/舉手
  | "shaking-head"     // 搖頭
  | "stand-announce"   // 站立廣播
  | "gray-offline"     // 變灰（離線）
  | "deliver-item"     // 走向目標交付物
  | "radiate"          // 散發光圈（FlashBot）

export interface AnimationMapping {
  /** 哪個 agentId 被驅動（可用 "target" 表示事件的 target_agent）*/
  agent: string | "target" | "all";
  animation: AgentAnimation;
  /** Office 對話泡泡文字（可選，undefined = 不顯示泡泡）*/
  bubbleText?: string;
  /** Status badge 文字（右下角 toast，可選）*/
  toastText?: string;
}

export const EVENT_ANIMATION_MAP: Record<EventType, AnimationMapping> = {
  [EventType.TASK_QUEUED]: {
    agent: "director",
    animation: "stand-announce",
    bubbleText: "新任務進隊列",
  },
  [EventType.TASK_RUNNING]: {
    agent: "target",
    animation: "working",
  },
  [EventType.TASK_DONE]: {
    agent: "target",
    animation: "celebrating",
    bubbleText: "✅ 完成",
  },
  [EventType.TASK_FAILED]: {
    agent: "target",
    animation: "shaking-head",
    bubbleText: "❌ 失敗",
  },
  [EventType.FUSION_PULSE]: {
    agent: "flashbot",
    animation: "radiate",
    bubbleText: "⚡ Fusion",
  },
  [EventType.NEWS_INGESTED]: {
    agent: "flashbot",
    animation: "deliver-item",
    bubbleText: "📰 新消息",
  },
  [EventType.STREAM_PULSE]: {
    agent: "flashbot",
    animation: "radiate",
  },
  [EventType.SOCIAL_PULSE]: {
    agent: "flashbot",
    animation: "radiate",
  },
  [EventType.CACHE_REFRESH]: {
    agent: "flashbot",
    animation: "idle",
  },
  [EventType.DECISION_READY]: {
    agent: "director",
    animation: "stand-announce",
    bubbleText: "📋 決策就緒",
  },
  [EventType.DELIBERATION_OPINION]: {
    agent: "all",             // Planner / Critic / Implementer 三者輪替
    animation: "talking",
  },
  [EventType.DELIBERATION_ARBITRATION]: {
    agent: "director",
    animation: "stand-announce",
    bubbleText: "🔨 拍板定案",
  },
  [EventType.LOCAL_RUNNER_ONLINE]: {
    agent: "flashbot",
    animation: "idle",
    bubbleText: "✅ 本地推理已恢復",
    toastText: "本地推理已恢復上線",
  },
  [EventType.LOCAL_RUNNER_OFFLINE]: {
    agent: "flashbot",
    animation: "gray-offline",
    bubbleText: "⚠️ 離線",
    toastText: "本地推理離線，已切換雲端備援",
  },
  [EventType.LOCAL_RUNNER_UNCONFIGURED]: {
    agent: "flashbot",
    animation: "gray-offline",
    bubbleText: "⚙️ 未配置",
    toastText: "雲端模式：本地推理未配置，已固定使用雲端",
  },
  [EventType.CONTENT_DRAFTED]: {
    agent: "scribe",
    animation: "working",
    bubbleText: "✍️ 草稿中",
  },
  [EventType.CONTENT_FINALIZED]: {
    agent: "scribe",
    animation: "deliver-item",
    bubbleText: "📤 交稿",
  },
  [EventType.INVESTMENT_ANALYSIS_START]: {
    agent: "director",
    animation: "thinking",
    bubbleText: "📊 投資分析進行中",
  },
  [EventType.INVESTMENT_ANALYSIS_PROGRESS]: {
    agent: "director",
    animation: "working",
    bubbleText: "🔄 分析節點推進中",
  },
  [EventType.INVESTMENT_ANALYSIS_COMPLETE]: {
    agent: "director",
    animation: "stand-announce",
    bubbleText: "📈 投資分析完成",
    toastText: "Investment Brain 分析已完成",
  },
};

// ────────────────────────────────────────────────────────────
// § 3  OpenClawTask
// ────────────────────────────────────────────────────────────

export type TaskStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface OpenClawTask {
  /** 全域唯一任務 ID（UUID v4）*/
  id: string;

  /** 人類可讀標題 */
  title: string;

  /** 詳細描述 */
  description?: string;

  /** 指派給哪個 Agent（agentId）*/
  assigned_to: string;

  /** 任務發起者（agentId 或 "system"）*/
  created_by: string;

  status: TaskStatus;
  priority: TaskPriority;

  /** 估算雲端 token 成本（USD，0 = 本地推理）*/
  estimated_cost_usd?: number;

  /** 實際使用的推理路徑 */
  inference_route?: "local" | "cloud" | "hybrid";

  /** ISO 8601 */
  created_at: string;
  updated_at: string;
  completed_at?: string;

  /** 任意元資料（可存 Deliberation taskId、correlation_id 等）*/
  metadata?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────
// § 4  OpenClawEvent
// ────────────────────────────────────────────────────────────

export type EventSeverity = "info" | "warning" | "error" | "critical";

export interface OpenClawEvent {
  /** 全域唯一事件 ID（UUID v4）*/
  id: string;

  type: EventType;
  severity: EventSeverity;

  /** 觸發此事件的 Agent 或服務 */
  source: string;

  /** 此事件影響的目標 Agent（可選）*/
  target_agent?: string;

  /** 關聯的任務 ID（可選）*/
  task_id?: string;

  /** 關聯的 Deliberation ID（可選）*/
  deliberation_id?: string;

  /** 任意事件負載 */
  payload: Record<string, unknown>;

  /** ISO 8601 */
  timestamp: string;
}

// ────────────────────────────────────────────────────────────
// § 5  OpenClawAgentState
// ────────────────────────────────────────────────────────────

export type AgentStatus =
  | "idle"
  | "working"
  | "thinking"
  | "talking"
  | "roaming"
  | "offline"
  | "unconfigured";

export type DeployMode = "local" | "cloud";
export type InferenceRoute = "local" | "cloud";

export interface AgentPosition {
  /** 等距格點座標（整數，100 cm/格）*/
  gx: number;
  gy: number;
}

export interface OpenClawAgentState {
  /** 唯一 Agent ID（snake_case，對應 .agent/agents/*.json 的 id 欄位）*/
  id: string;

  display_name: string;

  status: AgentStatus;

  /** 當前執行中的任務 ID（null = idle）*/
  current_task_id: string | null;

  /** 辦公室等距座標 */
  position: AgentPosition;

  /** 綁定的模型資訊 */
  model: {
    provider: string;
    model_id: string;
    mode?: string;
  };

  /** 當前推理路徑 */
  inference_route: InferenceRoute;

  /** ISO 8601：最後活躍時間 */
  last_active_at: string;

  /** 自由傳遞的狀態摘要（可顯示在 Office 泡泡中）*/
  status_message?: string;
}

// ────────────────────────────────────────────────────────────
// § 6  Gateway 狀態（可選，供 Office 初始載入）
// ────────────────────────────────────────────────────────────

export interface OpenClawGatewayStatus {
  deploy_mode: DeployMode;

  /** Local Runner 是否可達 */
  local_runner_available: boolean;

  /** 若 unconfigured：deploy_mode=cloud 且 base_url 為空 */
  local_runner_reason?: "CLOUD_MODE_BASEURL_EMPTY" | "HEALTH_CHECK_FAIL" | "OK";

  active_ws_connections: number;
  agents: OpenClawAgentState[];

  /** ISO 8601 */
  server_time: string;
}

// ────────────────────────────────────────────────────────────
// § 7  Deliberation（討論）Types
// ────────────────────────────────────────────────────────────

export type DeliberationRole = "planner" | "critic" | "implementer";
export type DeliberationLevel = "L0" | "L1" | "L2";

export interface DeliberationTurn {
  role: DeliberationRole;
  agent_id: string;
  content: string;
  timestamp: string;
}

export interface DeliberationSession {
  id: string;
  task_id: string;
  level: DeliberationLevel;
  turns: DeliberationTurn[];

  /** L2 仲裁結果（雲端）*/
  arbitration?: {
    final_plan: string;
    action_items: string[];
    risks: string[];
    confidence: number;
    arbitrated_by: string;
    arbitrated_at: string;
  };

  status: "in_progress" | "completed" | "failed";
  created_at: string;
  completed_at?: string;
}
