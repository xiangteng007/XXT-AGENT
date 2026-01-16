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

variable "firebase_project_id" {
  description = "Firebase Project ID"
  type        = string
  default     = ""
}

variable "storage_bucket" {
  description = "Cloud Storage bucket for images"
  type        = string
  default     = ""
}
