##########################################################################
# XXT-AGENT — 開機自動啟動管理
# scripts\manage-autostart.ps1
#
# 使用方式：
#   .\scripts\manage-autostart.ps1 -Enable    # 設定開機自動啟動
#   .\scripts\manage-autostart.ps1 -Disable   # 取消開機自動啟動
#   .\scripts\manage-autostart.ps1 -Status    # 查看目前狀態
##########################################################################

param(
    [switch]$Enable,
    [switch]$Disable,
    [switch]$Status
)

$TaskName  = "XXT-Agent-TelegramBot"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $ScriptDir "start-local-bot.ps1"

if ($Enable) {
    Write-Host "🔧 設定開機自動啟動..." -ForegroundColor Cyan

    $action  = New-ScheduledTaskAction `
        -Execute "pwsh.exe" `
        -Argument "-WindowStyle Hidden -NonInteractive -File `"$StartScript`" -SkipBuild" `
        -WorkingDirectory (Split-Path -Parent $ScriptDir)

    # 登入後自動執行（延遲 60 秒等待網路連線）
    $trigger = New-ScheduledTaskTrigger -AtLogon
    $trigger.Delay = "PT60S"

    $settings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit 0 `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 5) `
        -StartWhenAvailable

    $principal = New-ScheduledTaskPrincipal `
        -UserId $env:USERNAME `
        -LogonType Interactive `
        -RunLevel Highest

    # 先移除舊任務（若存在）
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask `
        -TaskName    $TaskName `
        -Action      $action `
        -Trigger     $trigger `
        -Settings    $settings `
        -Principal   $principal `
        -Description "XXT-AGENT Telegram Bot — 本機桌機模式自動啟動" | Out-Null

    Write-Host "✅ 已設定！下次登入後 60 秒自動啟動 Bot" -ForegroundColor Green
    Write-Host "   Task Name: $TaskName" -ForegroundColor Gray
}
elseif ($Disable) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "✅ 已取消開機自動啟動" -ForegroundColor Green
}
elseif ($Status) {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Host "📋 開機自動啟動：" -ForegroundColor Cyan
        Write-Host "   狀態：$($task.State)" -ForegroundColor White
        Write-Host "   上次執行：$($info.LastRunTime)" -ForegroundColor White
        Write-Host "   下次執行：$($info.NextRunTime)" -ForegroundColor White
    } else {
        Write-Host "❌ 開機自動啟動未設定" -ForegroundColor Yellow
        Write-Host "   使用 .\scripts\manage-autostart.ps1 -Enable 來設定" -ForegroundColor Gray
    }
}
else {
    Write-Host "使用方式:" -ForegroundColor Cyan
    Write-Host "  .\scripts\manage-autostart.ps1 -Enable    啟用開機自動啟動"
    Write-Host "  .\scripts\manage-autostart.ps1 -Disable   停用開機自動啟動"
    Write-Host "  .\scripts\manage-autostart.ps1 -Status    查看狀態"
}
