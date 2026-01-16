resource "google_cloud_tasks_queue" "social_collect" {
  name     = "social-collect-queue"
  location = var.region

  rate_limits {
    max_dispatches_per_second = 5
    max_concurrent_dispatches = 20
  }

  retry_config {
    max_attempts  = 8
    max_backoff   = "60s"
    min_backoff   = "1s"
    max_doublings = 6
  }
}
