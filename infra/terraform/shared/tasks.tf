# Cloud Tasks Queues
# Per SPEC_PHASE6_5_PHASE7_CLOUD.md

# Social Collect Queue
resource "google_cloud_tasks_queue" "social_collect" {
  name     = "social-collect-queue"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_dispatches_per_second = 5
    max_concurrent_dispatches = 20
  }

  retry_config {
    max_attempts       = 8
    max_backoff        = "60s"
    min_backoff        = "1s"
    max_doublings      = 6
    max_retry_duration = "3600s"
  }

  stackdriver_logging_config {
    sampling_ratio = 0.1
  }
}

# Market Collect Queue
resource "google_cloud_tasks_queue" "market_collect" {
  name     = "market-collect-queue"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_dispatches_per_second = 5
    max_concurrent_dispatches = 20
  }

  retry_config {
    max_attempts       = 8
    max_backoff        = "60s"
    min_backoff        = "1s"
    max_doublings      = 6
    max_retry_duration = "3600s"
  }

  stackdriver_logging_config {
    sampling_ratio = 0.1
  }
}

# Notify Dispatch Queue
resource "google_cloud_tasks_queue" "notify_dispatch" {
  name     = "notify-dispatch-queue"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_dispatches_per_second = 10
    max_concurrent_dispatches = 50
  }

  retry_config {
    max_attempts       = 8
    max_backoff        = "60s"
    min_backoff        = "1s"
    max_doublings      = 6
    max_retry_duration = "3600s"
  }

  stackdriver_logging_config {
    sampling_ratio = 0.5
  }
}

# Fusion Run Queue (optional high-priority)
resource "google_cloud_tasks_queue" "fusion_run" {
  name     = "fusion-run-queue"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_dispatches_per_second = 20
    max_concurrent_dispatches = 100
  }

  retry_config {
    max_attempts       = 5
    max_backoff        = "30s"
    min_backoff        = "1s"
    max_doublings      = 4
    max_retry_duration = "600s"
  }

  stackdriver_logging_config {
    sampling_ratio = 0.2
  }
}
