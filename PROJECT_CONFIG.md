# XXT-AGENT Platform - Project Configuration

## GCP Project

| 欄位 | 值 |
|------|-----|
| **專案名稱** | Investment Manager |
| **專案 ID** | investment-manager-1007 |
| **區域** | asia-east1 (Taiwan) |

## Deployed Services

| Service | URL | Status |
|---------|-----|--------|
| **AI Gateway** | <https://ai-gateway-400584093075.asia-east1.run.app> | ✅ Active |
| **Dashboard** | <https://xxt-frontend.vercel.app> | ✅ Active |

## URLs

- **GCP Console**: <https://console.cloud.google.com/home/dashboard?project=investment-manager-1007>
- **Cloud Run**: <https://console.cloud.google.com/run?project=investment-manager-1007>
- **Secret Manager**: <https://console.cloud.google.com/security/secret-manager?project=investment-manager-1007>

## Secret Manager Keys

| Secret Name | 用途 |
|-------------|------|
| `gemini-api-key` | Gemini AI API Key (for ai-gateway) |

## Service Accounts

- **Default Compute**: `400584093075-compute@developer.gserviceaccount.com`

## Repository

- **GitHub**: <https://github.com/xiangteng007/XXT-AGENT>
- **Frontend (Vercel)**: xxt-frontend

## Architecture Version

- **Current**: v2.0.0 (Production-Grade Upgrade)
- **Last Updated**: 2026-01-17
