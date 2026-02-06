# Runtime Service Account for Cloud Run services
# Using data source to reference existing service account (avoids 409 conflict)

data "google_service_account" "runtime_sa" {
  account_id = "ai-me-runtime-prod"
}

# IAM bindings are idempotent and safe to apply repeatedly
resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_service_account.runtime_sa.email}"
}

resource "google_project_iam_member" "pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${data.google_service_account.runtime_sa.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${data.google_service_account.runtime_sa.email}"
}

resource "google_project_iam_member" "cloudtasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${data.google_service_account.runtime_sa.email}"
}
