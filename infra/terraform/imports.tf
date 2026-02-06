# Import blocks for existing Cloud Run services
# These are needed for the FIRST run to populate the Terraform state
# After state is populated (stored in GCS), these can be removed

# Cloud Run services
import {
  id = "projects/xxt-agent/locations/asia-east1/services/ai-gateway"
  to = google_cloud_run_v2_service.ai_gateway
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/market-streamer"
  to = google_cloud_run_v2_service.market_streamer
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/news-collector"
  to = google_cloud_run_v2_service.news_collector
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/quote-normalizer"
  to = google_cloud_run_v2_service.quote_normalizer
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/social-worker"
  to = google_cloud_run_v2_service.social_worker
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/social-collector"
  to = google_cloud_run_v2_service.social_dispatcher
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/fusion-engine"
  to = google_cloud_run_v2_service.fusion_engine
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/alert-engine"
  to = google_cloud_run_v2_service.alert_engine
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/trade-planner"
  to = google_cloud_run_v2_service.trade_planner
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/telegram-bot"
  to = google_cloud_run_v2_service.telegram_bot
}
