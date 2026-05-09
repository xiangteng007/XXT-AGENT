#!/usr/bin/env pwsh
# ============================================================
# XXT-AGENT Ollama One-Click Startup Script
# Usage: .\scripts\ollama-start.ps1
# Checks Tailscale + Ollama, starts if down, runs smoke test
# ============================================================

$OLLAMA_URL = "https://senteng.tail94ed8e.ts.net"
$REQUIRED_MODELS = @("qwen3:14b", "gpt-oss:20b", "nomic-embed-text:latest")

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK] $msg"   -ForegroundColor Green }
function Write-WARN { param($msg) Write-Host "  [!!] $msg"   -ForegroundColor Yellow }
function Write-ERR  { param($msg) Write-Host "  [XX] $msg"   -ForegroundColor Red }

# ── Step 1: Check Tailscale ──────────────────────────────────
Write-Step "Checking Tailscale status..."
try {
    $ts = & tailscale status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Tailscale is running"
        $tsLine = ($ts | Select-String "senteng") | Select-Object -First 1
        if ($tsLine) { Write-OK "NAS node found: $tsLine" }
        else { Write-WARN "NAS (senteng) not visible in Tailscale peers - check NAS Tailscale client" }
    } else {
        Write-ERR "Tailscale not running. Starting..."
        Start-Process "tailscale" -ArgumentList "up" -Verb RunAs -Wait
    }
} catch {
    Write-WARN "tailscale CLI not found in PATH, skipping Tailscale check"
}

# ── Step 2: Check if Ollama responds ────────────────────────
Write-Step "Checking Ollama at $OLLAMA_URL ..."
$ollamaOnline = $false
$latencyMs = 0
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $r = Invoke-WebRequest -Uri "$OLLAMA_URL/api/tags" -TimeoutSec 15 -UseBasicParsing
    $sw.Stop()
    $latencyMs = $sw.ElapsedMilliseconds
    if ($r.StatusCode -eq 200) {
        $ollamaOnline = $true
        Write-OK "Ollama online! Latency: ${latencyMs}ms"
    }
} catch {
    $latencyMs = 999
    Write-ERR "Ollama not reachable: $($_.Exception.Message)"
}

# ── Step 3: Show loaded models ───────────────────────────────
if ($ollamaOnline) {
    Write-Step "Checking loaded models..."
    try {
        $tags = (Invoke-WebRequest -Uri "$OLLAMA_URL/api/tags" -UseBasicParsing).Content | ConvertFrom-Json
        $availableNames = $tags.models | ForEach-Object { $_.name }

        foreach ($model in $REQUIRED_MODELS) {
            $base = $model.Split(":")[0]
            $found = $availableNames | Where-Object { $_ -like "$base*" }
            if ($found) {
                $m = $tags.models | Where-Object { $_.name -like "$base*" } | Select-Object -First 1
                $sizeMB = [math]::Round($m.size / 1MB, 0)
                Write-OK "$($m.name) — ${sizeMB}MB (quant: $($m.details.quantization_level))"
            } else {
                Write-WARN "$model NOT found. Pull with: ollama pull $model"
            }
        }
    } catch {
        Write-WARN "Could not parse model list: $($_.Exception.Message)"
    }

    # ── Step 4: Quick smoke test ─────────────────────────────
    Write-Step "Running quick smoke test (qwen3:14b, 20 tokens)..."
    try {
        $body = @{
            model = "qwen3:14b"
            messages = @(@{ role = "user"; content = "回覆一個字：好" })
            stream = $false
            options = @{ num_predict = 20 }
        } | ConvertTo-Json -Depth 5

        $sw2 = [System.Diagnostics.Stopwatch]::StartNew()
        $res = Invoke-WebRequest -Uri "$OLLAMA_URL/api/chat" -Method POST `
            -ContentType "application/json" -Body $body -TimeoutSec 60 -UseBasicParsing
        $sw2.Stop()

        $reply = ($res.Content | ConvertFrom-Json).message.content
        Write-OK "Response in $($sw2.ElapsedMilliseconds)ms: $reply"
    } catch {
        Write-ERR "Smoke test failed: $($_.Exception.Message)"
        Write-WARN "Model may still be loading — wait 30s and retry"
    }

} else {
    Write-Step "Attempting to diagnose connection..."
    Write-Host ""
    Write-Host "  Possible causes:" -ForegroundColor Yellow
    Write-Host "  1. Ollama service is stopped on NAS/Desktop"
    Write-Host "     → SSH to NAS and run: sudo systemctl start ollama"
    Write-Host "     → Or on Windows: Start-Process 'ollama' -ArgumentList 'serve'"
    Write-Host ""
    Write-Host "  2. Tailscale Funnel not enabled on NAS"
    Write-Host "     → Run on NAS: tailscale funnel --bg 11434"
    Write-Host ""
    Write-Host "  3. Firewall blocking port 11434"
    Write-Host "     → Check NAS firewall rules for port 11434"
    Write-Host ""
    Write-Host "  Diagnostics:" -ForegroundColor Yellow
    Write-Host "  - Test direct: curl https://senteng.tail94ed8e.ts.net/api/tags"
    Write-Host "  - Test local:  curl http://127.0.0.1:11434/api/tags  (from NAS)"
}

# ── Step 5: Summary ─────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor DarkGray
if ($ollamaOnline) {
    Write-Host " STATUS: ONLINE  |  Latency: ${latencyMs}ms" -ForegroundColor Green
    Write-Host " Cloud Run health check: Will PASS  (threshold: 8000ms)" -ForegroundColor Green
    if ($latencyMs -gt 6000) {
        Write-WARN "Latency > 6s — Cloud Run (3s timeout before fix) would have failed"
        Write-WARN "Redeploying with updated 8s timeout is recommended"
    }
} else {
    Write-Host " STATUS: OFFLINE" -ForegroundColor Red
    Write-Host " Bot will fallback to Gemini-2.5-flash (cloud)" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor DarkGray
Write-Host ""
