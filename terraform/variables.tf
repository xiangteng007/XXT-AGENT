# Terraform Variables for SENTENG Platform

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-east1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "firebase_project_id" {
  description = "Firebase Project ID (usually same as GCP project)"
  type        = string
}

variable "storage_bucket" {
  description = "Cloud Storage bucket name for images"
  type        = string
}

variable "gemini_api_key_secret" {
  description = "Secret Manager secret name for Gemini API key"
  type        = string
  default     = "GEMINI_API_KEY"
}

variable "cloud_run_min_instances" {
  description = "Minimum instances for Cloud Run services"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum instances for Cloud Run services"
  type        = number
  default     = 10
}
