# Cloud Scheduler for Social Intelligence
# Per SPEC_PHASE6_5_PHASE7_CLOUD.md

# Social Poll Tick - Every minute
resource "google_cloud_scheduler_job" "social_poll_tick" {
  name        = "social-poll-tick"
  description = "Trigger social-dispatcher every minute"
  schedule    = "* * * * *"
  time_zone   = "Asia/Taipei"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${var.social_dispatcher_url}/dispatch"

    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
    }
  }

  retry_config {
    retry_count          = 1
    min_backoff_duration = "5s"
    max_backoff_duration = "30s"
  }
}

# Service Account for Scheduler
resource "google_service_account" "scheduler_sa" {
  account_id   = "social-scheduler-sa"
  display_name = "Social Intelligence Scheduler"
  project      = var.project_id
}

# Grant Cloud Run invoker role
resource "google_cloud_run_service_iam_member" "scheduler_invoker" {
  count    = var.social_dispatcher_url != "" ? 1 : 0
  service  = "social-collector"
  location = var.region
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_sa.email}"
}
