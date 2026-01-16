resource "google_pubsub_topic" "raw_market" {
  name = "raw.market"
}
resource "google_pubsub_topic" "raw_news" {
  name = "raw.news"
}
resource "google_pubsub_topic" "raw_social" {
  name = "raw.social"
}
resource "google_pubsub_topic" "fused_event" {
  name = "fused.event"
}
resource "google_pubsub_topic" "events_dlq" {
  name = "events.dlq"
}

# Subscriptions for streaming pull services (per naming hardcode spec)
resource "google_pubsub_subscription" "raw_market_fuser" {
  name                 = "raw-market-fuser"
  topic                = google_pubsub_topic.raw_market.name
  ack_deadline_seconds = 30
}

resource "google_pubsub_subscription" "raw_news_fuser" {
  name                 = "raw-news-fuser"
  topic                = google_pubsub_topic.raw_news.name
  ack_deadline_seconds = 30
}

resource "google_pubsub_subscription" "raw_social_fuser" {
  name                 = "raw-social-fuser"
  topic                = google_pubsub_topic.raw_social.name
  ack_deadline_seconds = 30
}

resource "google_pubsub_subscription" "fused_event_notifier" {
  name                 = "fused-event-notifier"
  topic                = google_pubsub_topic.fused_event.name
  ack_deadline_seconds = 30
}
