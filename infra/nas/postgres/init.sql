-- =============================================================
-- OpenClaw PostgreSQL Schema
-- infra/nas/postgres/init.sql
-- =============================================================
-- ── Deliberation Sessions（長期審計）────────────────────────
CREATE TABLE IF NOT EXISTS delib_sessions (
    task_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    turns_count INTEGER DEFAULT 0,
    final_summary TEXT,
    created_by TEXT,
    -- agent id 或 'system'
    metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_delib_sessions_created ON delib_sessions(created_at DESC);
-- ── Event Audit Log（可選：長期事件記錄）────────────────────
CREATE TABLE IF NOT EXISTS oc_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    target_agent TEXT,
    task_id TEXT,
    severity TEXT DEFAULT 'info',
    payload JSONB,
    emitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oc_events_type ON oc_events(event_type, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_oc_events_task ON oc_events(task_id)
WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oc_events_source ON oc_events(source, emitted_at DESC);
-- ── Agent Performance Metrics（效能追蹤）────────────────────
CREATE TABLE IF NOT EXISTS agent_metrics (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    latency_ms INTEGER,
    inference_route TEXT,
    -- 'local' | 'cloud'
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_id ON agent_metrics(agent_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_type ON agent_metrics(event_type, recorded_at DESC);
-- ── 初始化確認 ───────────────────────────────────────────────
DO $$ BEGIN RAISE NOTICE 'OpenClaw schema initialized at %',
now();
END $$;