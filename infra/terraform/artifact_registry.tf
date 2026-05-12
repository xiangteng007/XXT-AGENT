# Use data source to reference existing repository
# The repository was already created manually in GCP Console
data "google_artifact_registry_repository" "repo" {
  repository_id = "ai-me-services"
  location      = var.region
}

# Dedicated AR repo for OpenClaw Gateway (created 2026-05-12)
data "google_artifact_registry_repository" "openclaw" {
  repository_id = "openclaw"
  location      = var.region
}

# Local value for the repository path used by Cloud Run services
locals {
  artifact_registry_path = "${var.region}-docker.pkg.dev/${var.project_id}/ai-me-services"
}
