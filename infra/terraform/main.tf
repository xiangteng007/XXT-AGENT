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

# Reference existing Redis instance (already created in GCP Console)
data "google_redis_instance" "cache" {
  name   = "xxt-cache"
  region = var.region
}
