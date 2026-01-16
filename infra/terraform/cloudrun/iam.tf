# IAM for Cloud Run services

# Runtime Service Account
resource "google_service_account" "runtime_sa" {
  account_id   = "aime-runtime-${var.env}"
  display_name = "AI ME Runtime SA (${var.env})"
  project      = var.project_id
}

# Pub/Sub Publisher (for streamers/collectors)
resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}

# Pub/Sub Subscriber (for fusion-engine/notifier)
resource "google_project_iam_member" "pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}

# Secret Manager Accessor
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}

# Firestore User (for state/metrics)
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}

# Cloud Run Invoker (for health checks)
resource "google_project_iam_member" "run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.runtime_sa.email}"
}
