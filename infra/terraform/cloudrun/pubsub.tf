# Pub/Sub Topics for Event-Driven Architecture
# Per SPEC_PHASE6_5_PHASE7_CLOUD.md

# Raw events from collectors
resource "google_pubsub_topic" "raw_market" {
  name    = "raw.market.${var.env}"
  project = var.project_id

  message_retention_duration = "86400s"

  labels = {
    env     = var.env
    service = "market-streamer"
  }
}

resource "google_pubsub_topic" "raw_news" {
  name    = "raw.news.${var.env}"
  project = var.project_id

  message_retention_duration = "86400s"

  labels = {
    env     = var.env
    service = "news-collector"
  }
}

resource "google_pubsub_topic" "raw_social" {
  name    = "raw.social.${var.env}"
  project = var.project_id

  message_retention_duration = "86400s"

  labels = {
    env     = var.env
    service = "social-collector"
  }
}

# Fused events (output of fusion-engine)
resource "google_pubsub_topic" "fused_event" {
  name    = "fused.event.${var.env}"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days

  labels = {
    env     = var.env
    service = "fusion-engine"
  }
}

# Dead Letter Topic
resource "google_pubsub_topic" "dlq" {
  name    = "events.dlq.${var.env}"
  project = var.project_id

  message_retention_duration = "604800s"

  labels = {
    env     = var.env
    purpose = "dead-letter"
  }
}

# Subscriptions for fusion-engine (receives raw events)
resource "google_pubsub_subscription" "raw_market_fuser" {
  name  = "sub.raw-market.fuser.${var.env}"
  topic = google_pubsub_topic.raw_market.name

  ack_deadline_seconds = 60

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

resource "google_pubsub_subscription" "raw_news_fuser" {
  name  = "sub.raw-news.fuser.${var.env}"
  topic = google_pubsub_topic.raw_news.name

  ack_deadline_seconds = 60

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

resource "google_pubsub_subscription" "raw_social_fuser" {
  name  = "sub.raw-social.fuser.${var.env}"
  topic = google_pubsub_topic.raw_social.name

  ack_deadline_seconds = 60

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

# Subscription for notifier (receives fused events)
resource "google_pubsub_subscription" "fused_event_notifier" {
  name  = "sub.fused-event.notifier.${var.env}"
  topic = google_pubsub_topic.fused_event.name

  ack_deadline_seconds = 30

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "5s"
    maximum_backoff = "300s"
  }
}
