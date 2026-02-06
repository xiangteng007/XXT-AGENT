locals {
  ar_host = "${var.region}-docker.pkg.dev"
  ar_repo = data.google_artifact_registry_repository.repo.repository_id
  img = {
    market_streamer   = "${local.ar_host}/${var.project_id}/${local.ar_repo}/market-streamer:latest"
    news_collector    = "${local.ar_host}/${var.project_id}/${local.ar_repo}/news-collector:latest"
    social_dispatcher = "${local.ar_host}/${var.project_id}/${local.ar_repo}/social-dispatcher:latest"
    social_worker     = "${local.ar_host}/${var.project_id}/${local.ar_repo}/social-worker:latest"
    fusion_engine     = "${local.ar_host}/${var.project_id}/${local.ar_repo}/event-fusion-engine:latest"
    alert_engine      = "${local.ar_host}/${var.project_id}/${local.ar_repo}/alert-engine:latest"
    trade_planner     = "${local.ar_host}/${var.project_id}/${local.ar_repo}/trade-planner-worker:latest"
    telegram_bot      = "${local.ar_host}/${var.project_id}/${local.ar_repo}/telegram-command-bot:latest"
    quote_normalizer  = "${local.ar_host}/${var.project_id}/${local.ar_repo}/quote-normalizer:latest"
    ai_gateway        = "${local.ar_host}/${var.project_id}/${local.ar_repo}/ai-gateway:latest"
  }
}

resource "google_cloud_run_v2_service" "ai_gateway" {
  name     = "ai-gateway"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.ai_gateway
      resources {
        cpu_idle          = true
        startup_cpu_boost = true
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
      }
      env {
        name  = "GEMINI_SECRET_ID"
        value = "gemini-api-key"
      }
    }
  }
}

resource "google_cloud_run_v2_service" "market_streamer" {
  name     = "market-streamer"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.market_streamer
      resources {
        cpu_idle = false
      }
      ports {
        container_port = 8080
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "PUBSUB_TOPIC_QUOTES_RAW"
        value = data.google_pubsub_topic.raw_market.name
      }
      env {
        name  = "FINNHUB_SECRET_NAME"
        value = "finnhub-api-key"
      }
      env {
        name  = "STREAMER_SYMBOLS"
        value = "AAPL,MSFT,GOOGL,AMZN,TSLA,SPY,QQQ"
      }
      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        timeout_seconds       = 10
        period_seconds        = 10
        failure_threshold     = 10
      }
    }
    scaling {
      min_instance_count = 1
    }
  }
}

resource "google_cloud_run_v2_service" "news_collector" {
  name     = "news-collector"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.news_collector
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "TOPIC_RAW_NEWS"
        value = data.google_pubsub_topic.raw_news.name
      }
    }
  }
}

resource "google_cloud_run_v2_service" "quote_normalizer" {
  name     = "quote-normalizer"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.quote_normalizer
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "REDIS_HOST"
        value = data.google_redis_instance.cache.host
      }
      env {
        name  = "TOPIC_EVENTS_NORMALIZED"
        value = data.google_pubsub_topic.raw_market.name # Reusing same bus for simplicity
      }
    }
  }
}

resource "google_cloud_run_v2_service" "social_worker" {
  name     = "social-worker"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.social_worker
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "TOPIC_RAW_SOCIAL"
        value = data.google_pubsub_topic.raw_social.name
      }
    }
  }
}

resource "google_cloud_run_v2_service" "social_dispatcher" {
  name     = "social-collector" # Keep name for backward compat if needed
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.social_dispatcher
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "SOCIAL_TASK_QUEUE"
        value = local.social_task_queue_name
      }
      env {
        name  = "SOCIAL_WORKER_URL"
        value = google_cloud_run_v2_service.social_worker.uri
      }
    }
  }
}

resource "google_cloud_run_v2_service" "fusion_engine" {
  name     = "fusion-engine"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.fusion_engine
      resources {
        cpu_idle = false
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "TOPIC_FUSED_EVENT"
        value = data.google_pubsub_topic.fused_event.name
      }
      env {
        name  = "REDIS_HOST"
        value = data.google_redis_instance.cache.host
      }
    }
  }
}

resource "google_cloud_run_v2_service" "alert_engine" {
  name     = "alert-engine"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.alert_engine
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "REDIS_HOST"
        value = data.google_redis_instance.cache.host
      }
      env {
        name  = "TELEGRAM_BOT_TOKEN"
        value = var.telegram_bot_token
      }
      env {
        name  = "USE_LLM_ALERT_OPERATOR"
        value = "true"
      }
      env {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
      }
    }
  }
}

resource "google_cloud_run_v2_service" "trade_planner" {
  name     = "trade-planner"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.trade_planner
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
      }
      env {
        name  = "REDIS_HOST"
        value = data.google_redis_instance.cache.host
      }
    }
  }
}

resource "google_cloud_run_v2_service" "telegram_bot" {
  name     = "telegram-bot"
  location = var.region

  template {
    service_account = google_service_account.runtime_sa.email
    containers {
      image = local.img.telegram_bot
      ports {
        container_port = 8080
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "TELEGRAM_BOT_TOKEN"
        value = var.telegram_bot_token
      }
      env {
        name  = "TRADE_PLANNER_URL"
        value = google_cloud_run_v2_service.trade_planner.uri
      }
      env {
        name  = "REDIS_HOST"
        value = data.google_redis_instance.cache.host
      }
      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        timeout_seconds       = 10
        period_seconds        = 10
        failure_threshold     = 10
      }
    }
  }
}

