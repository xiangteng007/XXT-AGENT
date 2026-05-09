@echo off
chcp 65001 >nul
echo ==============================================
echo XXT-AGENT 1-Click Startup
echo ==============================================

echo [1/3] Starting Ollama (Local AI Engine)...
start "Ollama" ollama serve
timeout /t 3

echo [2/3] Starting Firebase Emulator...
cd apps\functions
start "Firebase Emulator" npm run serve
timeout /t 10

echo [3/3] Starting ngrok on port 5001...
start "ngrok" ngrok http 5001

echo ==============================================
echo Environment is starting. 
echo After ngrok starts, copy the Forwarding URL 
echo and run set_webhook.bat (or update Telegram).
echo ==============================================
pause
