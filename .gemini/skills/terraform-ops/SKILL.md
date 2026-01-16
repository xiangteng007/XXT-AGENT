---
name: terraform-ops
description: |
  Terraform 基礎設施即程式碼（IaC）操作規範，包含 Cloud Run Always-on、Pub/Sub、Secret Manager 配置。
---

# Terraform Ops 規範

## Cloud Run Always-on CPU 設定

```hcl
resources {
  cpu_idle = false  # Always-on CPU
}

scaling {
  min_instance_count = 1  # 至少 1 實例
  max_instance_count = 5
}
```

## 必須部署的資源

### Pub/Sub Topics

- `raw.market.{env}` — 原始市場事件
- `raw.news.{env}` — 原始新聞事件
- `raw.social.{env}` — 原始社群事件
- `fused.event.{env}` — 融合事件
- `events.dlq.{env}` — Dead Letter Queue

### Cloud Run Services

- `market-streamer` — 市場資料輪詢
- `news-collector` — 新聞 RSS 收集
- `social-collector` — 社群監控
- `fusion-engine` — 事件融合
- `notifier` — 推播通知

### Secret Manager

- `telegram-bot-token-{env}`
- `telegram-chat-id-{env}`
- `line-notify-token-{env}`
- `gemini-api-key-{env}`

## 部署順序

```bash
# 1. 初始化
cd infra/terraform/cloudrun
terraform init

# 2. 預覽
terraform plan -var="project_id=YOUR_PROJECT"

# 3. 部署
terraform apply -var="project_id=YOUR_PROJECT" \
  -var="telegram_bot_token=XXX" \
  -var="telegram_chat_id=XXX"
```

## 成本控制

- Cloud Run min instances = 1（每服務約 $30-50/月）
- 設定 max instances 上限避免爆成本
- 使用 Pub/Sub 避免服務間直接呼叫
