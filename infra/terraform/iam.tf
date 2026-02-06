# IAM Configuration - Deprecated
#
# This file previously defined a service account and IAM bindings
# for Cloud Run services that are no longer deployed.
#
# Active IAM configurations for this project are managed via:
# - Google Cloud Console
# - Other deployment workflows
#
# If you need to manage service accounts via Terraform, ensure:
# 1. The service account exists or will be created
# 2. The import block (if any) references an existing account
#
# Example configuration (commented out):
# resource "google_service_account" "runtime_sa" {
#   account_id   = "ai-me-runtime-prod"
#   display_name = "AI ME Runtime SA"
# }
#
# resource "google_project_iam_member" "pubsub_publisher" {
#   project = var.project_id
#   role    = "roles/pubsub.publisher"
#   member  = "serviceAccount:${google_service_account.runtime_sa.email}"
# }
