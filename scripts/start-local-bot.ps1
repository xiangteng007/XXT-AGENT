##########################################################################
# XXT-AGENT — 本機桌機模式啟動腳本
# scripts\start-local-bot.ps1
#
# 功能：
#   1. 編譯 TypeScript（可略過）
#   2. 啟動 Express Server (port 3000)
#   3. 啟動 Cloudflare Tunnel (quick tunnel，無需帳號)
#   4. 自動更新 Telegram Webhook URL
#
# 使用方式：
#   .\scripts\start-local-bot.ps1
#   .\scripts\start-local-bot.ps1 -SkipBuild      # 跳過編譯
#   .\scripts\start-local-bot.ps1 -SkipWebhook    # 跳過 Webhook 更新
##########################################################################
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$SkipWebhook
)

Set-StrictMode -Off
$ErrorActionPreference = "Continue"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = Split-Path -Parent $ScriptDir
$FuncDir     = Join-Path $RepoRoot "apps\functions"
$CfExe       = Join-Path $ScriptDir "cloudflared.exe"
$EnvLocal    = Join-Path $FuncDir ".env.local"
$LogDir      = Join-Path $RepoRoot "logs"
$ServerLog   = Join-Path $LogDir "server.log"
$TunnelLog   = Join-Path $LogDir "tunnel.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# ── 讀取 .env.local ───────────────────────────────────────
function Get-EnvValue {
    param([string]$Path, [string]$Key)
    if (-not (Test-Path $Path)) { return $null }
    $line = Select-String -Path $Path -Pattern "^${Key}=" | Select-Object -First 1
    if ($line) { return $line.Line.Split('=', 2)[1].Trim() }
    return $null
}

$BotToken = Get-EnvValue -Path $EnvLocal -Key "TELEGRAM_BOT_TOKEN"
$Port     = Get-EnvValue -Path $EnvLocal -Key "PORT"
if (-not $Port) { $Port = "3000" }

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   XXT-AGENT Bot  --  Local Desktop Mode ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: 停止舊程序 ────────────────────────────────────
Write-Host "[1/4] Stopping old processes..." -ForegroundColor Yellow
Get-Process -Name "node"        -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# ── Step 2: 編譯 TypeScript ──────────────────────────────
if (-not $SkipBuild) {
    Write-Host "[2/4] Compiling TypeScript..." -ForegroundColor Yellow
    Push-Location $FuncDir
    $buildOut = & npx tsc 2>&1
    $buildExit = $LASTEXITCODE
    Pop-Location
    if ($buildExit -ne 0) {
        Write-Host "ERROR: TypeScript compile failed!" -ForegroundColor Red
        Write-Host ($buildOut -join "`n") -ForegroundColor Red
        exit 1
    }
    Write-Host "   OK Build succeeded" -ForegroundColor Green
} else {
    Write-Host '[2/4] Skipping build (flag set)' -ForegroundColor Gray
}

# ── Step 3: 啟動 Express Server ──────────────────────────
Write-Host "[3/4] Starting Express Server on port $Port..." -ForegroundColor Yellow

$serverProcess = Start-Process `
    -FilePath "node" `
    -ArgumentList "lib\server.js" `
    -WorkingDirectory $FuncDir `
    -RedirectStandardOutput $ServerLog `
    -RedirectStandardError  $ServerLog `
    -PassThru `
    -NoNewWindow

Start-Sleep -Seconds 4

$serverOk = $false
$retries = 0
while (-not $serverOk -and $retries -lt 5) {
    $resp = $null
    $resp = Invoke-WebRequest "http://localhost:$Port/healthz" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($resp -and $resp.StatusCode -eq 200) {
        $serverOk = $true
    } else {
        Start-Sleep -Seconds 2
        $retries++
    }
}

if (-not $serverOk) {
    Write-Host "ERROR: Server failed to start. Check logs\server.log" -ForegroundColor Red
    exit 1
}
Write-Host "   OK Server running (PID: $($serverProcess.Id))" -ForegroundColor Green

# ── Step 4: 啟動 Cloudflare Tunnel ──────────────────────
Write-Host "[4/4] Starting Cloudflare Tunnel..." -ForegroundColor Yellow

if (-not (Test-Path $CfExe)) {
    Write-Host "ERROR: cloudflared.exe not found at scripts\" -ForegroundColor Red
    exit 1
}

# 清空舊 tunnel log
if (Test-Path $TunnelLog) { Clear-Content $TunnelLog }

$tunnelProcess = Start-Process `
    -FilePath $CfExe `
    -ArgumentList "tunnel --url http://localhost:$Port" `
    -PassThru `
    -NoNewWindow `
    -RedirectStandardError $TunnelLog

Write-Host "   Waiting for tunnel URL..." -ForegroundColor Gray

$tunnelUrl = $null
$waited    = 0
$maxWait   = 40

while ((-not $tunnelUrl) -and ($waited -lt $maxWait)) {
    Start-Sleep -Seconds 2
    $waited += 2
    if (Test-Path $TunnelLog) {
        $logText = Get-Content $TunnelLog -Raw -ErrorAction SilentlyContinue
        if ($logText -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $tunnelUrl = $Matches[0]
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host "   WARNING: Could not parse tunnel URL from log." -ForegroundColor Yellow
    Write-Host "   Check logs\tunnel.log manually." -ForegroundColor Gray
} else {
    Write-Host "   OK Tunnel URL: $tunnelUrl" -ForegroundColor Green

    # ── 更新 Telegram Webhook ────────────────────────────
    if ((-not $SkipWebhook) -and $BotToken) {
        $webhookUrl = "$tunnelUrl/telegram"
        Write-Host ""
        Write-Host "Updating Telegram Webhook --> $webhookUrl" -ForegroundColor Cyan
        $setResp = Invoke-WebRequest `
            -Uri "https://api.telegram.org/bot${BotToken}/setWebhook?url=${webhookUrl}" `
            -UseBasicParsing `
            -TimeoutSec 10 `
            -ErrorAction SilentlyContinue
        if ($setResp) {
            $setJson = $setResp.Content | ConvertFrom-Json
            if ($setJson.ok) {
                Write-Host "   OK Webhook updated successfully!" -ForegroundColor Green
            } else {
                Write-Host "   WARNING: Webhook update failed: $($setJson.description)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   WARNING: Could not reach Telegram API" -ForegroundColor Yellow
        }
    }
}

# ── 摘要輸出 ─────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         Bot is ONLINE!                   ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Server PID : $($serverProcess.Id)"  -ForegroundColor White
Write-Host "  Tunnel PID : $($tunnelProcess.Id)"  -ForegroundColor White
Write-Host "  Tunnel URL : $tunnelUrl"             -ForegroundColor White
Write-Host "  Server Log : $ServerLog"             -ForegroundColor Gray
Write-Host "  Tunnel Log : $TunnelLog"             -ForegroundColor Gray
Write-Host ""
Write-Host '  Stop  : .\scripts\stop-local-bot.ps1' -ForegroundColor Gray
Write-Host '  Auto  : .\scripts\manage-autostart.ps1 -Enable' -ForegroundColor Gray
Write-Host ""

# 儲存 PID
$pidData = @"
{
  "serverPid": $($serverProcess.Id),
  "tunnelPid": $($tunnelProcess.Id),
  "tunnelUrl": "$tunnelUrl",
  "port": "$Port",
  "startedAt": "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}
"@
$pidData | Set-Content (Join-Path $LogDir "bot-pids.json") -Encoding UTF8
