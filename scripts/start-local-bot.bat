@echo off
:: XXT-AGENT Local Bot Launcher
:: Double-click this file to start the bot
:: Or use: start-local-bot.bat
title XXT-AGENT Bot Launcher

SET REPO=%~dp0..
SET FUNC=%REPO%\apps\functions
SET SCRIPTS=%REPO%\scripts
SET LOGS=%REPO%\logs

if not exist "%LOGS%" mkdir "%LOGS%"

echo.
echo ==========================================
echo    XXT-AGENT Bot  --  Local Desktop Mode
echo ==========================================
echo.

:: Stop old processes
echo [1/4] Stopping old processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
timeout /t 1 >nul

:: Compile TypeScript
echo [2/4] Compiling TypeScript...
cd /d "%FUNC%"
call npx tsc >"%LOGS%\build.log" 2>&1
if %errorlevel% neq 0 (
    echo ERROR: TypeScript compile failed. See logs\build.log
    pause
    exit /b 1
)
echo    OK Build succeeded

:: Start Express Server
echo [3/4] Starting Express Server on port 3000...
start /B node lib\server.js > "%LOGS%\server-out.log" 2> "%LOGS%\server-err.log"

:: Wait for server
timeout /t 5 >nul
curl -s http://localhost:3000/healthz >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Server not responding. Check logs\server-err.log
    pause
    exit /b 1
)
echo    OK Server running

:: Start Cloudflare Tunnel
echo [4/4] Starting Cloudflare Tunnel...
start /B "%SCRIPTS%\cloudflared.exe" tunnel --url http://localhost:3000 2> "%LOGS%\tunnel.log"

echo    Waiting for tunnel URL...
timeout /t 10 >nul

:: Find tunnel URL from log
for /f "tokens=*" %%i in ('findstr "trycloudflare.com" "%LOGS%\tunnel.log"') do (
    set TUNNEL_LINE=%%i
)

echo.
echo ==========================================
echo    Bot is ONLINE!
echo ==========================================
echo.
echo    Local:  http://localhost:3000
echo    Logs:   %LOGS%\
echo.
echo    Tip: Run manage-autostart.bat to enable boot auto-start
echo.
pause
