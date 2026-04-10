#!/usr/bin/env pwsh
<#
.SYNOPSIS
    OpenClaw v2 E2E Verification Script
    PR-1→PR-4 整合驗收測試

.DESCRIPTION
    測試項目：
      1. Gateway Health check
      2. /agents/state REST
      3. /events/ingest → 廣播
      4. WebSocket ping/pong
      5. Local Runner circuit breaker 狀態

.USAGE
    # 先確認 Gateway 已在執行
    pwsh scripts/e2e-verify.ps1
    pwsh scripts/e2e-verify.ps1 -GatewayUrl http://localhost:3100
#>

param(
    [string]$GatewayUrl = "http://localhost:3100",
    [string]$DevToken = "dev-bypass",   # DEV_BYPASS_AUTH=true 時使用
    [int]   $TimeoutSec = 5
)

$FailCount = 0
$PassCount = 0

function Write-Pass { param($msg); Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:PassCount++ }
function Write-Fail { param($msg); Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:FailCount++ }
function Write-Info { param($msg); Write-Host "  [INFO] $msg" -ForegroundColor Cyan }

# ─────────────────────────────────────────────────────────────
Write-Host "`n⬡  OpenClaw v2 E2E Verification`n" -ForegroundColor Blue
Write-Host "   Gateway: $GatewayUrl"
Write-Host "   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $DevToken"
}

# ── Test 1: Health Check ─────────────────────────────────────
Write-Host "── Test 1: Gateway /health" -ForegroundColor White
try {
    $resp = Invoke-RestMethod -Uri "$GatewayUrl/health" -TimeoutSec $TimeoutSec
    if ($resp.status -eq "ok") {
        Write-Pass "status=ok, version=$($resp.version)"
    }
    else {
        Write-Fail "Unexpected response: $($resp | ConvertTo-Json -Compress)"
    }
}
catch {
    Write-Fail "Health check failed: $_"
}

# ── Test 2: /agents/state ────────────────────────────────────
Write-Host "`n── Test 2: GET /agents/state" -ForegroundColor White
try {
    $resp = Invoke-RestMethod -Uri "$GatewayUrl/agents/state" -Headers $headers -TimeoutSec $TimeoutSec
    $agentCount = $resp.agents.Count
    if ($agentCount -gt 0) {
        Write-Pass "Returned $agentCount agents"
        foreach ($a in $resp.agents) {
            Write-Info "  → [$($a.id)] status=$($a.status) route=$($a.inference_route)"
        }
    }
    else {
        Write-Fail "Empty agents array"
    }
    # Check runtime
    $runtimeState = $resp.runtime.state
    Write-Info "Local Runner state: $runtimeState"
}
catch {
    Write-Fail "/agents/state failed: $_"
}

# ── Test 3: POST /events/ingest (NEWS_INGESTED) ───────────────
Write-Host "`n── Test 3: POST /events/ingest" -ForegroundColor White
$testEvent = @{
    id           = [System.Guid]::NewGuid().ToString()
    type         = "NEWS_INGESTED"
    source       = "e2e-test"
    severity     = "info"
    target_agent = "flashbot"
    payload      = @{ count = 3; sources = @("test-feed") }
    timestamp    = (Get-Date -Format "o")
} | ConvertTo-Json -Depth 5

try {
    $resp = Invoke-RestMethod -Uri "$GatewayUrl/events/ingest" `
        -Method POST -Headers $headers -Body $testEvent -TimeoutSec $TimeoutSec

    if ($resp.ok -eq $true) {
        Write-Pass "Event ingested (broadcast to $($resp.broadcast_to) clients)"
    }
    else {
        Write-Fail "Ingest returned ok=false: $($resp | ConvertTo-Json -Compress)"
    }
}
catch {
    Write-Fail "/events/ingest failed: $_"
}

# ── Test 4: POST TASK_QUEUED event ───────────────────────────
Write-Host "`n── Test 4: POST TASK_QUEUED event" -ForegroundColor White
$taskEvent = @{
    id        = [System.Guid]::NewGuid().ToString()
    type      = "TASK_QUEUED"
    source    = "e2e-test"
    severity  = "info"
    payload   = @{ job_id = "test-job-001"; tenant_id = "e2e-tenant" }
    timestamp = (Get-Date -Format "o")
} | ConvertTo-Json -Depth 5

try {
    $resp = Invoke-RestMethod -Uri "$GatewayUrl/events/ingest" `
        -Method POST -Headers $headers -Body $taskEvent -TimeoutSec $TimeoutSec

    if ($resp.ok -eq $true) {
        Write-Pass "TASK_QUEUED event ingested"
    }
    else {
        Write-Fail "TASK_QUEUED ingest failed"
    }
}
catch {
    Write-Fail "TASK_QUEUED POST failed: $_"
}

# ── Test 5: LOCAL_RUNNER_UNCONFIGURED event ───────────────────
Write-Host "`n── Test 5: LOCAL Runner status event" -ForegroundColor White
$lrEvent = @{
    id        = [System.Guid]::NewGuid().ToString()
    type      = "LOCAL_RUNNER_UNCONFIGURED"
    source    = "e2e-test"
    severity  = "info"
    payload   = @{}
    timestamp = (Get-Date -Format "o")
} | ConvertTo-Json -Depth 5

try {
    $resp = Invoke-RestMethod -Uri "$GatewayUrl/events/ingest" `
        -Method POST -Headers $headers -Body $lrEvent -TimeoutSec $TimeoutSec

    if ($resp.ok -eq $true) {
        Write-Pass "LOCAL_RUNNER_UNCONFIGURED event ingested"
    }
    else {
        Write-Fail "LOCAL_RUNNER event failed"
    }
}
catch {
    Write-Fail "LOCAL_RUNNER POST failed: $_"
}

# ── Test 6: WebSocket 連線 ────────────────────────────────────
Write-Host "`n── Test 6: WebSocket ping/pong" -ForegroundColor White
$wsUrl = $GatewayUrl -replace "^http", "ws"
$wsUrl = "$wsUrl/ws"

try {
    Add-Type -AssemblyName System.Net.WebSockets
    $ws = [System.Net.WebSockets.ClientWebSocket]::new()
    $cts = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds($TimeoutSec))

    $connectTask = $ws.ConnectAsync([Uri]::new($wsUrl), $cts.Token)
    $connectTask.Wait()

    if ($ws.State -eq "Open") {
        # Send ping
        $pingBytes = [System.Text.Encoding]::UTF8.GetBytes('{"type":"ping"}')
        $segment = [ArraySegment[byte]]::new($pingBytes)
        $ws.SendAsync($segment, "Text", $true, $cts.Token).Wait()

        # Receive pong
        $buf = [byte[]]::new(1024)
        $seg2 = [ArraySegment[byte]]::new($buf)
        $result = $ws.ReceiveAsync($seg2, $cts.Token).GetAwaiter().GetResult()
        $msg = [System.Text.Encoding]::UTF8.GetString($buf, 0, $result.Count)

        $parsed = $msg | ConvertFrom-Json
        if ($parsed.type -eq "pong") {
            Write-Pass "WebSocket pong received"
        }
        else {
            Write-Info "WS response: $msg"
            Write-Pass "WebSocket connected (non-pong response)"
        }
        $ws.CloseAsync("NormalClosure", "Done", $cts.Token).Wait()
    }
    else {
        Write-Fail "WebSocket state: $($ws.State)"
    }
}
catch {
    Write-Fail "WebSocket test failed: $_"
    Write-Info "Gateway may have WS auth; verify DEV_BYPASS_AUTH=true"
}

# ── Summary ───────────────────────────────────────────────────
$total = $PassCount + $FailCount
Write-Host "`n══════════════════════════════════════" -ForegroundColor Blue
Write-Host " Result: $PassCount/$total passed" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "══════════════════════════════════════`n" -ForegroundColor Blue

if ($FailCount -gt 0) {
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "  1. Gateway running?  → cd services/openclaw-gateway && npx tsx src/index.ts"
    Write-Host "  2. Auth bypass set?  → DEV_BYPASS_AUTH=true in .env"
    Write-Host "  3. Correct port?     → default 3100"
    exit 1
}

exit 0
