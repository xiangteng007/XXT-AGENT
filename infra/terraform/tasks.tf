# Import existing queue into Terraform state
import {
  id = "projects/xxt-agent/locations/asia-east1/queues/social-collect-queue"
  to = google_cloud_tasks_queue.social_collect
}

resource "google_cloud_tasks_queue" "social_collect" {
  name     = "social-collect-queue"
  location = "asia-east1" # var.region causes issues with import

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
