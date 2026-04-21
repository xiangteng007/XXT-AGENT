export declare enum EventType {
    TASK_QUEUED = "TASK_QUEUED",
    TASK_RUNNING = "TASK_RUNNING",
    TASK_DONE = "TASK_DONE",
    TASK_FAILED = "TASK_FAILED",
    FUSION_PULSE = "FUSION_PULSE",
    NEWS_INGESTED = "NEWS_INGESTED",
    STREAM_PULSE = "STREAM_PULSE",
    SOCIAL_PULSE = "SOCIAL_PULSE",
    CACHE_REFRESH = "CACHE_REFRESH",
    DECISION_READY = "DECISION_READY",
    DELIBERATION_OPINION = "DELIBERATION_OPINION",
    DELIBERATION_ARBITRATION = "DELIBERATION_ARBITRATION",
    LOCAL_RUNNER_ONLINE = "LOCAL_RUNNER_ONLINE",
    LOCAL_RUNNER_OFFLINE = "LOCAL_RUNNER_OFFLINE",
    LOCAL_RUNNER_UNCONFIGURED = "LOCAL_RUNNER_UNCONFIGURED",
    CONTENT_DRAFTED = "CONTENT_DRAFTED",
    CONTENT_FINALIZED = "CONTENT_FINALIZED",
    INVESTMENT_ANALYSIS_START = "INVESTMENT_ANALYSIS_START",
    INVESTMENT_ANALYSIS_PROGRESS = "INVESTMENT_ANALYSIS_PROGRESS",// F-06: SSE node-level progress
    INVESTMENT_ANALYSIS_COMPLETE = "INVESTMENT_ANALYSIS_COMPLETE"
}
export type AgentAnimation = "idle" | "working" | "thinking" | "talking" | "roaming" | "celebrating" | "shaking-head" | "stand-announce" | "gray-offline" | "deliver-item" | "radiate";
export interface AnimationMapping {
    /** 哪個 agentId 被驅動（可用 "target" 表示事件的 target_agent）*/
    agent: string | "target" | "all";
    animation: AgentAnimation;
    /** Office 對話泡泡文字（可選，undefined = 不顯示泡泡）*/
    bubbleText?: string;
    /** Status badge 文字（右下角 toast，可選）*/
    toastText?: string;
}
export declare const EVENT_ANIMATION_MAP: Record<EventType, AnimationMapping>;
export type TaskStatus = "queued" | "running" | "done" | "failed" | "cancelled";
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
export type AgentStatus = "idle" | "working" | "thinking" | "talking" | "roaming" | "offline" | "unconfigured";
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
//# sourceMappingURL=openclaw.d.ts.map