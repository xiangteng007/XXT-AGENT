# Cloud Scheduler for Market Intelligence
# Per SPEC_PHASE6_5_PHASE7_CLOUD.md

# Market Poll Tick - Every minute
resource "google_cloud_scheduler_job" "market_poll_tick" {
  name        = "market-poll-tick"
  description = "Trigger market-streamer every minute"
  schedule    = "* * * * *"
  time_zone   = "Asia/Taipei"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${var.market_streamer_url}/stream"

    oidc_token {
      service_account_email = google_service_account.market_scheduler_sa.email
    }
  }

  retry_config {
    retry_count          = 1
    min_backoff_duration = "5s"
    max_backoff_duration = "30s"
  }
}

# News Collector - Every 5 minutes
resource "google_cloud_scheduler_job" "news_poll_tick" {
  name        = "news-poll-tick"
  description = "Trigger market-news-worker every 5 minutes"
  schedule    = "*/5 * * * *"
  time_zone   = "Asia/Taipei"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${var.market_news_url}/collect"

    oidc_token {
      service_account_email = google_service_account.market_scheduler_sa.email
    }
  }

  retry_config {
    retry_count          = 2
    min_backoff_duration = "30s"
    max_backoff_duration = "120s"
  }
}

# Fusion Tick - Every 5 minutes
resource "google_cloud_scheduler_job" "fusion_poll_tick" {
  name        = "fusion-poll-tick"
  description = "Trigger fusion-engine every 5 minutes"
  schedule    = "*/5 * * * *"
  time_zone   = "Asia/Taipei"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${var.fusion_engine_url}/fuse"

    oidc_token {
      service_account_email = google_service_account.market_scheduler_sa.email
    }
  }

  retry_config {
    retry_count          = 1
    min_backoff_duration = "10s"
    max_backoff_duration = "60s"
  }
}

# Service Account for Market Scheduler
resource "google_service_account" "market_scheduler_sa" {
  account_id   = "market-scheduler-sa"
  display_name = "Market Intelligence Scheduler"
  project      = var.project_id
}
