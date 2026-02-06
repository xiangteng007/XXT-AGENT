resource "google_cloud_scheduler_job" "social_poll_tick" {
  name        = "social-poll-tick"
  description = "Trigger social-dispatcher every minute"
  schedule    = "* * * * *"
  time_zone   = "Asia/Taipei"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.social_dispatcher.uri}/dispatch"
    headers     = { "Content-Type" = "application/json" }
    body        = base64encode("{\"tenantId\":\"default\"}")
  }
}

resource "google_cloud_scheduler_job" "market_poll_tick" {
  name        = "market-poll-tick"
  description = "Trigger market-streamer every minute"
  schedule    = "* * * * *"
  time_zone   = "Asia/Taipei"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.market_streamer.uri}/tick"
    headers     = { "Content-Type" = "application/json" }
  }
}

resource "google_cloud_scheduler_job" "news_poll_tick" {
  name        = "news-poll-tick"
  description = "Trigger news-collector every 5 minutes"
  schedule    = "*/5 * * * *"
  time_zone   = "Asia/Taipei"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.news_collector.uri}/tick"
    headers     = { "Content-Type" = "application/json" }
  }
}
