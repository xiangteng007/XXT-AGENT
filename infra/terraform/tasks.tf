# Reference existing Cloud Tasks queue (already created in GCP Console)
data "google_cloud_tasks_queue" "social_collect" {
  name     = "social-collect-queue"
  location = var.region
}
