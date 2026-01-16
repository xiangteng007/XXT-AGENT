# Cloud Tasks Queues for Social Intelligence Pipeline
# Per SPEC_PHASE6_5_PHASE7.md

# Social Collect Queue - High throughput for social data collection
resource "google_cloud_tasks_queue" "social_collect_queue" {
  name     = "social-collect-queue"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_concurrent_dispatches = 100
    max_dispatches_per_second = 50
  }

  retry_config {
    max_attempts       = 5
    min_backoff        = "1s"
    max_backoff        = "60s"
    max_doublings      = 3
    max_retry_duration = "600s"
  }

  stackdriver_logging_config {
    sampling_ratio = 0.1
  }
}

# Social High Priority Queue - For urgent re-fetches
resource "google_cloud_tasks_queue" "social_high_priority_queue" {
  name     = "social-high-priority-queue"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_concurrent_dispatches = 50
    max_dispatches_per_second = 100
  }

  retry_config {
    max_attempts       = 3
    min_backoff        = "0.5s"
    max_backoff        = "10s"
    max_doublings      = 2
    max_retry_duration = "120s"
  }

  stackdriver_logging_config {
    sampling_ratio = 0.5
  }
}

# Market Collect Queue - For market data collection
resource "google_cloud_tasks_queue" "market_collect_queue" {
  name     = "market-collect-queue"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_concurrent_dispatches = 20
    max_dispatches_per_second = 10
  }

  retry_config {
    max_attempts       = 3
    min_backoff        = "1s"
    max_backoff        = "30s"
    max_doublings      = 2
    max_retry_duration = "300s"
  }

  stackdriver_logging_config {
    sampling_ratio = 0.2
  }
}

# Alert Queue - For sending notifications
resource "google_cloud_tasks_queue" "alert_queue" {
  name     = "alert-queue"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts       = 5
    min_backoff        = "2s"
    max_backoff        = "120s"
    max_doublings      = 4
    max_retry_duration = "1800s"
  }

  stackdriver_logging_config {
    sampling_ratio = 1.0
  }
}
