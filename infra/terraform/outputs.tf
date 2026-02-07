output "cloudrun_urls" {
  value = {
    ai_gateway        = google_cloud_run_v2_service.ai_gateway.uri
    market_streamer   = google_cloud_run_v2_service.market_streamer.uri
    news_collector    = google_cloud_run_v2_service.news_collector.uri
    social_dispatcher = google_cloud_run_v2_service.social_dispatcher.uri
    social_worker     = google_cloud_run_v2_service.social_worker.uri
    fusion_engine     = google_cloud_run_v2_service.fusion_engine.uri
    alert_engine      = google_cloud_run_v2_service.alert_engine.uri
    trade_planner     = google_cloud_run_v2_service.trade_planner.uri
    telegram_bot      = google_cloud_run_v2_service.telegram_bot.uri
  }
}

