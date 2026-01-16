# Social Intelligence Terraform Module
# Per SPEC_PHASE6_5_PHASE7_CLOUD.md

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.30.0"
    }
  }
}

# Variables
variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "asia-east1"
}
variable "env" {
  type    = string
  default = "prod"
}
variable "social_dispatcher_url" {
  type        = string
  description = "Cloud Run URL for social-dispatcher service"
}
variable "social_collector_url" {
  type        = string
  description = "Cloud Run URL for social-collector-worker service"
}
