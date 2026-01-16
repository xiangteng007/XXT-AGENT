# Secret Manager for sensitive credentials

resource "google_secret_manager_secret" "telegram_bot_token" {
  secret_id = "telegram-bot-token-${var.env}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    env     = var.env
    service = "notifier"
  }
}

resource "google_secret_manager_secret_version" "telegram_bot_token_v1" {
  count       = var.telegram_bot_token != "" ? 1 : 0
  secret      = google_secret_manager_secret.telegram_bot_token.id
  secret_data = var.telegram_bot_token
}

resource "google_secret_manager_secret" "telegram_chat_id" {
  secret_id = "telegram-chat-id-${var.env}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    env     = var.env
    service = "notifier"
  }
}

resource "google_secret_manager_secret_version" "telegram_chat_id_v1" {
  count       = var.telegram_chat_id != "" ? 1 : 0
  secret      = google_secret_manager_secret.telegram_chat_id.id
  secret_data = var.telegram_chat_id
}

resource "google_secret_manager_secret" "line_notify_token" {
  secret_id = "line-notify-token-${var.env}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    env     = var.env
    service = "notifier"
  }
}

resource "google_secret_manager_secret_version" "line_notify_token_v1" {
  count       = var.line_notify_token != "" ? 1 : 0
  secret      = google_secret_manager_secret.line_notify_token.id
  secret_data = var.line_notify_token
}

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "gemini-api-key-${var.env}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    env     = var.env
    service = "fusion-engine"
  }
}

resource "google_secret_manager_secret_version" "gemini_api_key_v1" {
  count       = var.gemini_api_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}
