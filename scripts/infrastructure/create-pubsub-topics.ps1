# =============================================================================
# XXT-AGENT v9.0 — GCP Pub/Sub Topic 初始化腳本
# 建立所有 v9.0 所需的 Pub/Sub topics 和 subscriptions
# =============================================================================
#
# USAGE:
#   .\create-pubsub-topics.ps1 -ProjectId <gcp-project-id>
#
# PREREQUISITES:
#   gcloud CLI 已認證：gcloud auth login
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,

    [string]$Region = "asia-east1",
    [int]$MessageRetentionDays = 7,
    [int]$AckDeadlineSeconds = 60
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " XXT-AGENT v9.0 — Pub/Sub Topic Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Project: $ProjectId" -ForegroundColor Gray
Write-Host ""

# ── Topic 定義 ────────────────────────────────────────────────
$Topics = @(
    @{
        Name        = "news.raw"
        Description = "Raw news events from news-collector (Finnhub + RSS)"
        Subscribers = @("event-fusion-engine", "ai-gateway")
    },
    @{
        Name        = "audit.log"
        Description = "Audit log events for all XXT-AGENT services (v9.0)"
        Subscribers = @("audit-processor")
    },
    @{
        Name        = "agent.tasks"
        Description = "Agent Orchestration Protocol task events (v9.0 AOP)"
        Subscribers = @("openclaw-gateway")
    },
    @{
        Name        = "market.alerts"
        Description = "Market alert events from alert-engine"
        Subscribers = @("social-dispatcher", "telegram-command-bot")
    },
    @{
        Name        = "trade.signals"
        Description = "Trade signals from trade-planner-worker"
        Subscribers = @("openclaw-gateway")
    }
)

$RetentionDuration = "${MessageRetentionDays}d"
$Created = 0
$Skipped = 0

foreach ($topic in $Topics) {
    $topicName = $topic.Name
    $fullTopicPath = "projects/$ProjectId/topics/$topicName"

    Write-Host "[Topic] $topicName" -ForegroundColor Yellow
    Write-Host "  描述: $($topic.Description)" -ForegroundColor Gray

    # ── 建立 Topic ────────────────────────────────────────────
    $existing = gcloud pubsub topics describe $topicName --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ 已存在，跳過" -ForegroundColor DarkGray
        $Skipped++
    } else {
        gcloud pubsub topics create $topicName `
            --project=$ProjectId `
            --message-retention-duration=$RetentionDuration | Out-Null
        Write-Host "  ✅ Topic 已建立 (retention: ${MessageRetentionDays}d)" -ForegroundColor Green
        $Created++
    }

    # ── 建立 Subscriptions ────────────────────────────────────
    foreach ($subscriber in $topic.Subscribers) {
        $subName = "$topicName--$subscriber"

        $subExisting = gcloud pubsub subscriptions describe $subName --project=$ProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Subscription [$subName] 已存在" -ForegroundColor DarkGray
        } else {
            gcloud pubsub subscriptions create $subName `
                --project=$ProjectId `
                --topic=$topicName `
                --ack-deadline=$AckDeadlineSeconds `
                --message-retention-duration=$RetentionDuration `
                --expiration-period="never" | Out-Null
            Write-Host "  ✅ Subscription [$subName] 已建立" -ForegroundColor Green
        }
    }

    Write-Host ""
}

# ── 設定 Dead Letter Topics ────────────────────────────────────
Write-Host "[DLQ] 建立 Dead Letter Queue topics..." -ForegroundColor Yellow

$DlqTopics = @("news.raw.dlq", "audit.log.dlq", "agent.tasks.dlq")
foreach ($dlq in $DlqTopics) {
    $dlqExisting = gcloud pubsub topics describe $dlq --project=$ProjectId 2>&1
    if ($LASTEXITCODE -ne 0) {
        gcloud pubsub topics create $dlq `
            --project=$ProjectId `
            --message-retention-duration=$RetentionDuration | Out-Null
        Write-Host "  ✅ DLQ [$dlq] 已建立" -ForegroundColor Green
    } else {
        Write-Host "  ✓ DLQ [$dlq] 已存在" -ForegroundColor DarkGray
    }
}

# ── 輸出摘要 ──────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " 設定完成！" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Topics: $Created 新建 / $Skipped 已存在" -ForegroundColor White
Write-Host ""
Write-Host "環境變數（請設定到 Cloud Run / Secret Manager）：" -ForegroundColor White
Write-Host "  TOPIC_NEWS_RAW   = news.raw" -ForegroundColor Gray
Write-Host "  TOPIC_AUDIT_LOG  = audit.log" -ForegroundColor Gray
Write-Host "  TOPIC_AGENT_TASKS = agent.tasks" -ForegroundColor Gray
Write-Host ""
Write-Host "下一步：" -ForegroundColor White
Write-Host "  1. 確認 Cloud Run SA 有 roles/pubsub.publisher 權限" -ForegroundColor Gray
Write-Host "  2. 執行 deploy-cloudrun 部署服務" -ForegroundColor Gray
Write-Host "  3. 驗證：gcloud pubsub topics list --project=$ProjectId" -ForegroundColor Gray
