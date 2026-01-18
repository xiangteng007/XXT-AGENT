# Import existing Cloud Run services into Terraform state
# Only import services that already exist in GCP (these caused 409 conflicts)
# Services that don't exist yet will be created by Terraform

import {
  id = "projects/xxt-agent/locations/asia-east1/services/quote-normalizer"
  to = google_cloud_run_v2_service.quote_normalizer
}

import {
  id = "projects/xxt-agent/locations/asia-east1/services/social-worker"
  to = google_cloud_run_v2_service.social_worker
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
