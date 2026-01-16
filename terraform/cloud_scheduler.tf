# Cloud Scheduler Jobs for Social Intelligence and Market Intel
# Per SPEC_PHASE6_5_PHASE7.md

# Social Dispatcher - Runs every minute to fan out collect jobs
resource "google_cloud_scheduler_job" "social_dispatcher" {
  name        = "social-dispatcher-job"
  description = "Triggers social intelligence dispatcher every minute"
  schedule    = "* * * * *"  # Every minute
  time_zone   = "Asia/Taipei"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.functions.status[0].url}/social-dispatcher"

    oidc_token {
      service_account_email = google_service_account.scheduler_invoker.email
    }
  }

  retry_config {
    retry_count          = 1
    min_backoff_duration = "5s"
    max_backoff_duration = "30s"
  }
}

# Market Streamer - Runs every minute for real-time market data
resource "google_cloud_scheduler_job" "market_streamer" {
  name        = "market-streamer-job"
  description = "Triggers market intelligence streamer every minute"
  schedule    = "* * * * *"  # Every minute
  time_zone   = "Asia/Taipei"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.functions.status[0].url}/market-streamer"

    oidc_token {
      service_account_email = google_service_account.scheduler_invoker.email
    }
  }

  retry_config {
    retry_count          = 1
    min_backoff_duration = "5s"
    max_backoff_duration = "30s"
  }
}

# Daily Cleanup - Runs at 3:00 AM Taiwan time
resource "google_cloud_scheduler_job" "daily_cleanup" {
  name        = "daily-cleanup-job"
  description = "Triggers daily cleanup of old jobs, logs, and images"
  schedule    = "0 3 * * *"  # 3:00 AM daily
  time_zone   = "Asia/Taipei"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.functions.status[0].url}/cleanup"

    oidc_token {
      service_account_email = google_service_account.scheduler_invoker.email
    }
  }

  retry_config {
    retry_count          = 3
    min_backoff_duration = "60s"
    max_backoff_duration = "300s"
  }
}

# News Collector - Runs every 5 minutes
resource "google_cloud_scheduler_job" "news_collector" {
  name        = "news-collector-job"
  description = "Triggers news intelligence collection every 5 minutes"
  schedule    = "*/5 * * * *"  # Every 5 minutes
  time_zone   = "Asia/Taipei"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.functions.status[0].url}/news-collector"

    oidc_token {
      service_account_email = google_service_account.scheduler_invoker.email
    }
  }

  retry_config {
    retry_count          = 2
    min_backoff_duration = "30s"
    max_backoff_duration = "120s"
  }
}

# Service Account for Scheduler to invoke Cloud Run
resource "google_service_account" "scheduler_invoker" {
  account_id   = "scheduler-invoker"
  display_name = "Cloud Scheduler Invoker"
  project      = var.project_id
}

# Grant Cloud Run invoker role
resource "google_cloud_run_service_iam_member" "scheduler_invoker" {
  service  = google_cloud_run_service.functions.name
  location = var.region
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_invoker.email}"
}
