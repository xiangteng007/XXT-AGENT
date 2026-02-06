# Artifact Registry Configuration - Deprecated
#
# This file previously referenced the 'ai-me-services' Artifact Registry.
# The registry may or may not exist in the current project.
#
# If you need to use Artifact Registry via Terraform:
# 1. Ensure the repository exists in GCP
# 2. Uncomment and update the data source below
#
# Example (commented out):
# data "google_artifact_registry_repository" "repo" {
#   repository_id = "ai-me-services"
#   location      = var.region
# }
#
# locals {
#   artifact_registry_path = "${var.region}-docker.pkg.dev/${var.project_id}/ai-me-services"
# }
