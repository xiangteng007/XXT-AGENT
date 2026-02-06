# Import existing service account into Terraform state
import {
  id = "projects/xxt-agent/serviceAccounts/ai-me-runtime-prod@xxt-agent.iam.gserviceaccount.com"
  to = google_service_account.runtime_sa
}

resource "google_service_account" "runtime_sa" {
  account_id   = "ai-me-runtime-prod" # Fixed to match existing
  display_name = "AI ME Runtime SA"
}

resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}

resource "google_project_iam_member" "pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}

resource "google_project_iam_member" "cloudtasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}
