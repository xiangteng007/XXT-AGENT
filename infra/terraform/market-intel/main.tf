# Market Intelligence Terraform Module
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
variable "region" { type = string default = "asia-east1" }
variable "env" { type = string default = "prod" }
variable "market_streamer_url" { 
  type = string 
  description = "Cloud Run URL for market-streamer service"
}
variable "market_news_url" {
  type = string
  description = "Cloud Run URL for market-news-worker service"
}
variable "fusion_engine_url" {
  type = string
  description = "Cloud Run URL for fusion-engine service"
}
