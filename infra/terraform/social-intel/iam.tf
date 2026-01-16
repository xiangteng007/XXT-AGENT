# IAM for Social Intelligence Services
# Per SPEC_PHASE6_5_PHASE7_CLOUD.md

# Service Account for Social Collector Worker
resource "google_service_account" "collector_sa" {
  account_id   = "social-collector-sa"
  display_name = "Social Collector Worker"
  project      = var.project_id
}

# Firestore access
resource "google_project_iam_member" "collector_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.collector_sa.email}"
}

# Secret Manager access
resource "google_project_iam_member" "collector_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.collector_sa.email}"
}

# Pub/Sub publisher
resource "google_project_iam_member" "collector_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.collector_sa.email}"
}

# Cloud Tasks creator
resource "google_project_iam_member" "collector_tasks" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.collector_sa.email}"
}
