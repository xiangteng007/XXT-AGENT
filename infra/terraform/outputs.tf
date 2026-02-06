output "cloudrun_urls" {
  value = {
    market_streamer   = google_cloud_run_v2_service.market_streamer.uri
    news_collector    = google_cloud_run_v2_service.news_collector.uri
    social_dispatcher = google_cloud_run_v2_service.social_dispatcher.uri
    social_worker     = google_cloud_run_v2_service.social_worker.uri
    fusion_engine     = google_cloud_run_v2_service.fusion_engine.uri
    alert_engine      = google_cloud_run_v2_service.alert_engine.uri
  }
}
