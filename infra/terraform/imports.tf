# Import existing Cloud Run services into Terraform state
# Only import services that already exist in GCP

# NOTE: news-collector was migrated to Firebase Functions and deleted from Cloud Run
# Import blocks for deleted services have been removed to prevent Terraform errors

import {
  id = "projects/xxt-agent/locations/asia-east1/services/ai-gateway"
  to = google_cloud_run_v2_service.ai_gateway
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/market-streamer"
  to = google_cloud_run_v2_service.market_streamer
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/quote-normalizer"
  to = google_cloud_run_v2_service.quote_normalizer
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/social-worker"
  to = google_cloud_run_v2_service.social_worker
}
