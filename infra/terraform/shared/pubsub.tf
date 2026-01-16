# Pub/Sub Topics for Event-Driven Architecture
# Per SPEC_PHASE6_5_PHASE7_CLOUD.md

# Normalized events from social/market collectors
resource "google_pubsub_topic" "events_normalized" {
  name    = "events.normalized"
  project = var.project_id

  message_retention_duration = "86400s"  # 24 hours

  labels = {
    env     = var.env
    purpose = "social-market-events"
  }
}

# Fused events after correlation
resource "google_pubsub_topic" "events_fused" {
  name    = "events.fused"
  project = var.project_id

  message_retention_duration = "86400s"

  labels = {
    env     = var.env
    purpose = "fusion-output"
  }
}

# Operations alerts (DLQ, errors, etc.)
resource "google_pubsub_topic" "ops_alerts" {
  name    = "ops.alerts"
  project = var.project_id

  message_retention_duration = "604800s"  # 7 days

  labels = {
    env     = var.env
    purpose = "operations"
  }
}

# Dead Letter Topic for failed messages
resource "google_pubsub_topic" "dlq" {
  name    = "events.dlq"
  project = var.project_id

  message_retention_duration = "604800s"

  labels = {
    env     = var.env
    purpose = "dead-letter"
  }
}

# Subscriptions for consumers
resource "google_pubsub_subscription" "fusion_engine_sub" {
  name  = "fusion-engine-sub"
  topic = google_pubsub_topic.events_normalized.name

  ack_deadline_seconds = 60

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    env = var.env
  }
}

resource "google_pubsub_subscription" "alert_engine_sub" {
  name  = "alert-engine-sub"
  topic = google_pubsub_topic.events_fused.name

  ack_deadline_seconds = 30

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "5s"
    maximum_backoff = "300s"
  }

  labels = {
    env = var.env
  }
}
