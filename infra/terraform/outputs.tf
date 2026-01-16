output "cloudrun_urls" {
  value = {
    market_streamer   = google_cloud_run_v2_service.market_streamer.uri
    news_collector    = google_cloud_run_v2_service.news_collector.uri
    social_dispatcher = google_cloud_run_v2_service.social_dispatcher.uri
    social_worker     = google_cloud_run_v2_service.social_worker.uri
    event_fuser       = google_cloud_run_v2_service.event_fuser.uri
    notifier          = google_cloud_run_v2_service.notifier.uri
  }
}
