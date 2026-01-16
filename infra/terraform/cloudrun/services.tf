# Cloud Run v2 Services with Always-on CPU
# Per SPEC: cpu_idle = false + min_instance_count = 1

locals {
  base_env = [
    { name = "GCP_PROJECT_ID", value = var.project_id },
    { name = "ENV", value = var.env },
    { name = "TOPIC_RAW_MARKET", value = google_pubsub_topic.raw_market.name },
    { name = "TOPIC_RAW_NEWS", value = google_pubsub_topic.raw_news.name },
    { name = "TOPIC_RAW_SOCIAL", value = google_pubsub_topic.raw_social.name },
    { name = "TOPIC_FUSED_EVENT", value = google_pubsub_topic.fused_event.name },
  ]

  container_resources = {
    limits = {
      cpu    = "1"
      memory = "512Mi"
    }
  }
}

# ================================
# Market Streamer (polls market data → raw.market)
# ================================
resource "google_cloud_run_v2_service" "market_streamer" {
  name     = "market-streamer-${var.env}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.runtime_sa.email

    containers {
      image = var.market_streamer_image != "" ? var.market_streamer_image : "gcr.io/${var.project_id}/market-streamer:latest"

      resources {
        limits   = local.container_resources.limits
        cpu_idle = false # Always-on CPU for background loop
      }

      dynamic "env" {
        for_each = local.base_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      env {
        name  = "POLL_INTERVAL_MS"
        value = "5000"
      }

      env {
        name  = "WATCHLIST"
        value = "2330.TW,2317.TW,^TWII"
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 30
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 3
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  labels = {
    env     = var.env
    service = "market-streamer"
  }
}

# ================================
# News Collector (polls RSS/news → raw.news)
# ================================
resource "google_cloud_run_v2_service" "news_collector" {
  name     = "news-collector-${var.env}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.runtime_sa.email

    containers {
      image = var.news_collector_image != "" ? var.news_collector_image : "gcr.io/${var.project_id}/news-collector:latest"

      resources {
        limits   = local.container_resources.limits
        cpu_idle = false
      }

      dynamic "env" {
        for_each = local.base_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      env {
        name  = "POLL_INTERVAL_MS"
        value = "60000"
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 30
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 2
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  labels = {
    env     = var.env
    service = "news-collector"
  }
}

# ================================
# Social Collector (polls social → raw.social)
# ================================
resource "google_cloud_run_v2_service" "social_collector" {
  name     = "social-collector-${var.env}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.runtime_sa.email

    containers {
      image = var.social_collector_image != "" ? var.social_collector_image : "gcr.io/${var.project_id}/social-collector:latest"

      resources {
        limits   = local.container_resources.limits
        cpu_idle = false
      }

      dynamic "env" {
        for_each = local.base_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      env {
        name  = "POLL_INTERVAL_MS"
        value = "60000"
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 30
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 2
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  labels = {
    env     = var.env
    service = "social-collector"
  }
}

# ================================
# Fusion Engine (subscribes raw.* → fused.event)
# ================================
resource "google_cloud_run_v2_service" "fusion_engine" {
  name     = "fusion-engine-${var.env}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.runtime_sa.email

    containers {
      image = var.fusion_engine_image != "" ? var.fusion_engine_image : "gcr.io/${var.project_id}/fusion-engine:latest"

      resources {
        limits   = local.container_resources.limits
        cpu_idle = false
      }

      dynamic "env" {
        for_each = local.base_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      env {
        name  = "SUB_RAW_MARKET"
        value = google_pubsub_subscription.raw_market_fuser.name
      }

      env {
        name  = "SUB_RAW_NEWS"
        value = google_pubsub_subscription.raw_news_fuser.name
      }

      env {
        name  = "SUB_RAW_SOCIAL"
        value = google_pubsub_subscription.raw_social_fuser.name
      }

      env {
        name = "GEMINI_API_KEY_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 30
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 3
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  labels = {
    env     = var.env
    service = "fusion-engine"
  }
}

# ================================
# Notifier (subscribes fused.event → Telegram/LINE/Webhook)
# ================================
resource "google_cloud_run_v2_service" "notifier" {
  name     = "notifier-${var.env}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.runtime_sa.email

    containers {
      image = var.notifier_image != "" ? var.notifier_image : "gcr.io/${var.project_id}/notifier:latest"

      resources {
        limits   = local.container_resources.limits
        cpu_idle = false
      }

      dynamic "env" {
        for_each = local.base_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      env {
        name  = "SUB_FUSED_EVENT"
        value = google_pubsub_subscription.fused_event_notifier.name
      }

      env {
        name = "TELEGRAM_BOT_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.telegram_bot_token.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "TELEGRAM_CHAT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.telegram_chat_id.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "LINE_NOTIFY_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.line_notify_token.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 30
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  labels = {
    env     = var.env
    service = "notifier"
  }
}

# ================================
# Outputs
# ================================
output "market_streamer_url" {
  value = google_cloud_run_v2_service.market_streamer.uri
}

output "news_collector_url" {
  value = google_cloud_run_v2_service.news_collector.uri
}

output "social_collector_url" {
  value = google_cloud_run_v2_service.social_collector.uri
}

output "fusion_engine_url" {
  value = google_cloud_run_v2_service.fusion_engine.uri
}

output "notifier_url" {
  value = google_cloud_run_v2_service.notifier.uri
}
