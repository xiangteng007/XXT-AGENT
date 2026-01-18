terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Redis instance for caching
resource "google_redis_instance" "cache" {
  name           = "xxt-cache"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region

  redis_version = "REDIS_7_0"
  display_name  = "XXT Agent Cache"

  authorized_network = "projects/${var.project_id}/global/networks/default"
}
