variable "project_id" {
  type = string
}
variable "region" {
  type    = string
  default = "asia-east1"
}
variable "env" {
  type    = string
  default = "prod"
}

variable "telegram_bot_token" {
  type      = string
  sensitive = true
}
variable "telegram_chat_id" {
  type      = string
  sensitive = true
}

variable "line_notify_token" {
  type      = string
  sensitive = true
  default   = ""
}
variable "webhook_url" {
  type    = string
  default = ""
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
}
