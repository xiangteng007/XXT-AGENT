# Cloud Run Services - Deprecated
# 
# This file previously defined Cloud Run services that were never deployed.
# All services have been removed as they don't exist in GCP.
#
# Active Cloud Run services in this project:
# - erp-api (managed separately via Cloud Console or other workflow)
# - light-keepers-api (managed separately)
#
# The services defined here (ai-gateway, market-streamer, news-collector, etc.)
# were migrated to Firebase Functions or are not currently in use.
#
# To add new Cloud Run services, define them here and update imports.tf

# Placeholder locals block to prevent Terraform errors
locals {
  ar_host = "${var.region}-docker.pkg.dev"
  ar_repo = data.google_artifact_registry_repository.repo.repository_id
}
