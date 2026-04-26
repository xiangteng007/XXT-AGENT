##########################################################################
# XXT-AGENT — 停止本機 Bot
# scripts\stop-local-bot.ps1
##########################################################################

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$LogDir    = Join-Path $RepoRoot "logs"
$PidFile   = Join-Path $LogDir "bot-pids.json"

Write-Host "🛑 停止 XXT-AGENT Bot..." -ForegroundColor Yellow

if (Test-Path $PidFile) {
    $pids = Get-Content $PidFile | ConvertFrom-Json
    foreach ($pid in @($pids.serverPid, $pids.tunnelPid)) {
        if ($pid) {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                Stop-Process -Id $pid -Force
                Write-Host "   ✅ 停止程序 PID $pid ($($proc.Name))" -ForegroundColor Green
            }
        }
    }
    Remove-Item $PidFile -Force
} else {
    # 強制終止所有相關程序
    Get-Process -Name "node"        -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "   ✅ 已終止所有 node / cloudflared 程序" -ForegroundColor Green
}

Write-Host "✅ Bot 已停止" -ForegroundColor Green
