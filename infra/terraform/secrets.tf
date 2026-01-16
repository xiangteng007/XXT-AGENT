resource "google_secret_manager_secret" "telegram_bot_token" {
  secret_id = "telegram-bot-token"
  replication {
    auto {}
  }
}
resource "google_secret_manager_secret_version" "telegram_bot_token_v1" {
  secret      = google_secret_manager_secret.telegram_bot_token.id
  secret_data = var.telegram_bot_token
}

resource "google_secret_manager_secret" "telegram_chat_id" {
  secret_id = "telegram-chat-id"
  replication {
    auto {}
  }
}
resource "google_secret_manager_secret_version" "telegram_chat_id_v1" {
  secret      = google_secret_manager_secret.telegram_chat_id.id
  secret_data = var.telegram_chat_id
}

resource "google_secret_manager_secret" "line_notify_token" {
  count     = var.line_notify_token == "" ? 0 : 1
  secret_id = "line-notify-token"
  replication {
    auto {}
  }
}
resource "google_secret_manager_secret_version" "line_notify_token_v1" {
  count       = var.line_notify_token == "" ? 0 : 1
  secret      = google_secret_manager_secret.line_notify_token[0].id
  secret_data = var.line_notify_token
}
