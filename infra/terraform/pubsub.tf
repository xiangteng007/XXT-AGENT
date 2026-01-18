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

# Reference existing Pub/Sub subscriptions
data "google_pubsub_subscription" "raw_market_fuser" {
  name = "raw-market-fuser"
}

data "google_pubsub_subscription" "raw_news_fuser" {
  name = "raw-news-fuser"
}

data "google_pubsub_subscription" "raw_social_fuser" {
  name = "raw-social-fuser"
}

data "google_pubsub_subscription" "fused_event_notifier" {
  name = "fused-event-notifier"
}
