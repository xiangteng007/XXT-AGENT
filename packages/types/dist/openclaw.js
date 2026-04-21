// ============================================================
// OpenClaw Contracts — PR-1
// 加入 packages/types/src/openclaw.ts
// 在 index.ts 中 re-export 此檔案
// ============================================================
// ────────────────────────────────────────────────────────────
// § 1  EventType 列舉（所有 OpenClaw 事件的單一來源）
// ────────────────────────────────────────────────────────────
export var EventType;
(function (EventType) {
    // ── Task 生命週期 ──────────────────────────────────────────
    EventType["TASK_QUEUED"] = "TASK_QUEUED";
    EventType["TASK_RUNNING"] = "TASK_RUNNING";
    EventType["TASK_DONE"] = "TASK_DONE";
    EventType["TASK_FAILED"] = "TASK_FAILED";
    // ── Execution Plane 資料流 ────────────────────────────────
    EventType["FUSION_PULSE"] = "FUSION_PULSE";
    EventType["NEWS_INGESTED"] = "NEWS_INGESTED";
    EventType["STREAM_PULSE"] = "STREAM_PULSE";
    EventType["SOCIAL_PULSE"] = "SOCIAL_PULSE";
    EventType["CACHE_REFRESH"] = "CACHE_REFRESH";
    // ── Agent 決策 ────────────────────────────────────────────
    EventType["DECISION_READY"] = "DECISION_READY";
    // ── Deliberation（討論）── ────────────────────────────────
    EventType["DELIBERATION_OPINION"] = "DELIBERATION_OPINION";
    EventType["DELIBERATION_ARBITRATION"] = "DELIBERATION_ARBITRATION";
    // ── Local Runner 狀態 ─────────────────────────────────────
    EventType["LOCAL_RUNNER_ONLINE"] = "LOCAL_RUNNER_ONLINE";
    EventType["LOCAL_RUNNER_OFFLINE"] = "LOCAL_RUNNER_OFFLINE";
    EventType["LOCAL_RUNNER_UNCONFIGURED"] = "LOCAL_RUNNER_UNCONFIGURED";
    // ── Scribe 內容 ───────────────────────────────────────────
    EventType["CONTENT_DRAFTED"] = "CONTENT_DRAFTED";
    EventType["CONTENT_FINALIZED"] = "CONTENT_FINALIZED";
    // ── P2-03: Investment Brain 事件 ──────────────────────────
    EventType["INVESTMENT_ANALYSIS_START"] = "INVESTMENT_ANALYSIS_START";
    EventType["INVESTMENT_ANALYSIS_PROGRESS"] = "INVESTMENT_ANALYSIS_PROGRESS";
    EventType["INVESTMENT_ANALYSIS_COMPLETE"] = "INVESTMENT_ANALYSIS_COMPLETE";
})(EventType || (EventType = {}));
export const EVENT_ANIMATION_MAP = {
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
        agent: "all", // Planner / Critic / Implementer 三者輪替
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
