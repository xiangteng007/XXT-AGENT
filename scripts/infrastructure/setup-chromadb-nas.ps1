# =============================================================================
# XXT-AGENT — ChromaDB NAS Deployment Script (Phase 3A)
# Target: ASUSTOR AS5404T NAS + Firebase Secret Manager
# Run from: Windows desktop (connects to NAS via SSH or Docker API)
# =============================================================================
#
# PREREQUISITES:
#   1. NAS reachable via SSH or has Docker API exposed on the LAN
#   2. Tailscale installed on NAS and joined to your tailnet
#   3. gcloud CLI installed and authenticated (gcloud auth login)
#   4. Firebase project: xxt-agent (or adjust $PROJECT_ID below)
#
# USAGE:
#   .\setup-chromadb-nas.ps1 -NasHost <nas-ip-or-hostname> -TailscaleUrl <https://xxx.ts.net>
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$NasHost,           # e.g., 192.168.1.100 or nas.local

    [Parameter(Mandatory=$true)]
    [string]$TailscaleUrl,      # e.g., https://mymachine.tail1234.ts.net

    [string]$ChromaPort = "8000",
    [string]$ChromaVolumePath = "/volume1/docker/chromadb",
    [string]$ProjectId = "xxt-agent",
    [string]$FirebaseRegion = "asia-east1"
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " XXT-AGENT ChromaDB NAS Setup (Phase 3A)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# ─── Step 1: Generate a secure ChromaDB auth token ───────────────────────────
Write-Host "`n[1/5] Generating ChromaDB auth token..." -ForegroundColor Yellow
$ChromaToken = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
Write-Host "  Token generated (64-char base64)" -ForegroundColor Green

# ─── Step 2: Deploy ChromaDB on NAS via SSH ──────────────────────────────────
Write-Host "`n[2/5] Deploying ChromaDB Docker container on NAS ($NasHost)..." -ForegroundColor Yellow

$DockerCmd = @"
docker pull chromadb/chroma:latest && \
docker rm -f chromadb 2>/dev/null || true && \
mkdir -p $ChromaVolumePath && \
docker run -d \
  --name chromadb \
  --restart=unless-stopped \
  -p ${ChromaPort}:8000 \
  -v ${ChromaVolumePath}:/chroma/chroma \
  -e CHROMA_SERVER_AUTH_CREDENTIALS=$ChromaToken \
  -e CHROMA_SERVER_AUTH_CREDENTIALS_PROVIDER=chromadb.auth.token.TokenConfigServerAuthCredentialsProvider \
  -e CHROMA_SERVER_AUTH_PROVIDER=chromadb.auth.token.TokenAuthServerProvider \
  chromadb/chroma:latest && \
echo 'ChromaDB started successfully'
"@

Write-Host "  SSH command to run on NAS:" -ForegroundColor Gray
Write-Host "  ssh admin@$NasHost '$DockerCmd'" -ForegroundColor Gray
Write-Host ""
Write-Host "  [ACTION REQUIRED] Run the above SSH command on your NAS, or use ASUSTOR ADM Docker Manager." -ForegroundColor Magenta
Write-Host "  Press ENTER when ChromaDB is running..." -ForegroundColor Magenta
Read-Host

# ─── Step 3: Verify ChromaDB health on LAN ───────────────────────────────────
Write-Host "`n[3/5] Verifying ChromaDB health check..." -ForegroundColor Yellow
$LanUrl = "http://${NasHost}:${ChromaPort}"
try {
    $response = Invoke-RestMethod -Uri "$LanUrl/api/v1/heartbeat" -TimeoutSec 10
    Write-Host "  ChromaDB heartbeat OK: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Warning "  ChromaDB not reachable at $LanUrl. Please check NAS firewall rules."
    Write-Host "  Continuing with Secret Manager setup anyway..." -ForegroundColor Yellow
}

# ─── Step 4: Set secrets in Firebase Secret Manager ─────────────────────────
Write-Host "`n[4/5] Configuring Firebase Secret Manager..." -ForegroundColor Yellow

$ChromaDbUrl = "${TailscaleUrl}:${ChromaPort}"
$OllamaUrl   = "${TailscaleUrl}:11434"

$Secrets = @(
    @{ Name = "CHROMADB_URL";   Value = $ChromaDbUrl },
    @{ Name = "CHROMADB_TOKEN"; Value = $ChromaToken },
    @{ Name = "OLLAMA_BASE_URL"; Value = $OllamaUrl }
)

foreach ($secret in $Secrets) {
    Write-Host "  Setting $($secret.Name)..." -ForegroundColor Gray
    # Using gcloud CLI to create/update secret
    $secretValue = $secret.Value
    $secretName  = $secret.Name

    # Check if secret exists
    $exists = gcloud secrets describe $secretName --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        # Add new version
        $secretValue | gcloud secrets versions add $secretName --project=$ProjectId --data-file=-
        Write-Host "    Updated existing secret: $secretName" -ForegroundColor Green
    } else {
        # Create new secret
        $secretValue | gcloud secrets create $secretName --project=$ProjectId `
            --replication-policy="user-managed" `
            --locations=$FirebaseRegion `
            --data-file=-
        Write-Host "    Created new secret: $secretName" -ForegroundColor Green
    }
}

# ─── Step 5: Grant Firebase Functions access to secrets ──────────────────────
Write-Host "`n[5/5] Granting Firebase Functions SA access to secrets..." -ForegroundColor Yellow

$ServiceAccount = "$ProjectId@appspot.gserviceaccount.com"
foreach ($secret in $Secrets) {
    $secretName = $secret.Name
    gcloud secrets add-iam-policy-binding $secretName `
        --project=$ProjectId `
        --member="serviceAccount:$ServiceAccount" `
        --role="roles/secretmanager.secretAccessor" | Out-Null
    Write-Host "  Granted access: $ServiceAccount -> $secretName" -ForegroundColor Green
}

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configured secrets:" -ForegroundColor White
Write-Host "  CHROMADB_URL   = $ChromaDbUrl" -ForegroundColor Gray
Write-Host "  CHROMADB_TOKEN = [REDACTED — stored in Secret Manager]" -ForegroundColor Gray
Write-Host "  OLLAMA_BASE_URL = $OllamaUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Redeploy Firebase Functions: firebase deploy --only functions" -ForegroundColor Gray
Write-Host "  2. Test memory storage: send a Telegram message and check ChromaDB collections" -ForegroundColor Gray
Write-Host "  3. Verify: curl -H 'Authorization: Bearer $ChromaToken' $ChromaDbUrl/api/v1/collections" -ForegroundColor Gray
Write-Host ""
Write-Host "ChromaDB Admin UI (if enabled): http://${NasHost}:${ChromaPort}" -ForegroundColor Gray
