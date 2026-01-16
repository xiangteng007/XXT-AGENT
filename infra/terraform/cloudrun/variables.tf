variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-east1"
}

variable "env" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# Container images
variable "market_streamer_image" {
  description = "Container image for market-streamer"
  type        = string
  default     = ""
}

variable "news_collector_image" {
  description = "Container image for news-collector"
  type        = string
  default     = ""
}

variable "social_collector_image" {
  description = "Container image for social-collector"
  type        = string
  default     = ""
}

variable "fusion_engine_image" {
  description = "Container image for fusion-engine"
  type        = string
  default     = ""
}

variable "notifier_image" {
  description = "Container image for notifier"
  type        = string
  default     = ""
}

# Secrets (sensitive)
variable "telegram_bot_token" {
  description = "Telegram bot token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "telegram_chat_id" {
  description = "Telegram chat ID for notifications"
  type        = string
  sensitive   = true
  default     = ""
}

variable "line_notify_token" {
  description = "LINE Notify access token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
  default     = ""
}
