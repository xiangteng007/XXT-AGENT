# Reference existing Pub/Sub topics (already created in GCP Console)
data "google_pubsub_topic" "raw_market" {
  name = "raw.market"
}
data "google_pubsub_topic" "raw_news" {
  name = "raw.news"
}
data "google_pubsub_topic" "raw_social" {
  name = "raw.social"
}
data "google_pubsub_topic" "fused_event" {
  name = "fused.event"
}
data "google_pubsub_topic" "events_dlq" {
  name = "events.dlq"
}

# ── v9.0 新增 Topics ──────────────────────────────────────────
resource "google_pubsub_topic" "audit_log" {
  name                       = "audit.log"
  message_retention_duration = "604800s" # 7 天

  labels = {
    env     = "production"
    service = "xxt-agent"
    version = "v9"
  }
}

resource "google_pubsub_topic" "news_raw" {
  name = "news.raw"

  labels = {
    env     = "production"
    service = "news-collector"
  }
}

resource "google_pubsub_topic" "law_updates" {
  name = "law.updates"
  message_retention_duration = "2592000s" # 30 天（法規更新需長保存）

  labels = {
    env     = "production"
    service = "regulation-rag"
  }
}

# ── v9.0 Subscriptions ───────────────────────────────────────
resource "google_pubsub_subscription" "audit_log_sub" {
  name  = "audit-log-sub"
  topic = google_pubsub_topic.audit_log.id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"

  # Dead-letter policy：5 次失敗後轉到 DLQ
  dead_letter_policy {
    dead_letter_topic     = data.google_pubsub_topic.events_dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

resource "google_pubsub_subscription" "news_raw_fusion_sub" {
  name  = "news-raw-fusion-sub"
  topic = google_pubsub_topic.news_raw.id

  ack_deadline_seconds = 30

  # Push to event-fusion-engine
  push_config {
    push_endpoint = "https://event-fusion-engine-${var.project_id}.${var.region}.run.app/pubsub"

    oidc_token {
      service_account_email = google_service_account.runtime_sa.email
    }
  }

  dead_letter_policy {
    dead_letter_topic     = data.google_pubsub_topic.events_dlq.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_subscription" "law_updates_rag_sub" {
  name  = "law-updates-rag-sub"
  topic = google_pubsub_topic.law_updates.id

  ack_deadline_seconds       = 120 # 重新索引需要更多時間
  message_retention_duration = "2592000s"

  # Push to regulation-rag for auto re-indexing
  push_config {
    push_endpoint = "https://regulation-rag-${var.project_id}.${var.region}.run.app/ingest"

    oidc_token {
      service_account_email = google_service_account.runtime_sa.email
    }
  }

  dead_letter_policy {
    dead_letter_topic     = data.google_pubsub_topic.events_dlq.id
    max_delivery_attempts = 3
  }
}

# ── DLQ Subscription (消費者) ────────────────────────────────
resource "google_pubsub_subscription" "events_dlq_sub" {
  name  = "events-dlq-consumer-sub"
  topic = data.google_pubsub_topic.events_dlq.id

  ack_deadline_seconds = 60

  # Push to event-fusion-engine /dlq handler
  push_config {
    push_endpoint = "https://event-fusion-engine-${var.project_id}.${var.region}.run.app/dlq"

    oidc_token {
      service_account_email = google_service_account.runtime_sa.email
    }
  }
}

# ── IAM：最小權限 ────────────────────────────────────────────
resource "google_pubsub_topic_iam_member" "runtime_audit_publisher" {
  topic  = google_pubsub_topic.audit_log.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.runtime_sa.email}"
}

resource "google_pubsub_topic_iam_member" "runtime_news_publisher" {
  topic  = google_pubsub_topic.news_raw.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.runtime_sa.email}"
}

resource "google_pubsub_topic_iam_member" "runtime_law_publisher" {
  topic  = google_pubsub_topic.law_updates.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.runtime_sa.email}"
}
