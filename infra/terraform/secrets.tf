# Reference existing Secret Manager secrets (already created in GCP Console)
data "google_secret_manager_secret" "telegram_bot_token" {
  secret_id = "telegram-bot-token"
}

data "google_secret_manager_secret" "telegram_chat_id" {
  secret_id = "telegram-chat-id"
}

# Note: line_notify_token is optional, keep as conditional data source
data "google_secret_manager_secret" "line_notify_token" {
  count     = var.line_notify_token == "" ? 0 : 1
  secret_id = "line-notify-token"
}
