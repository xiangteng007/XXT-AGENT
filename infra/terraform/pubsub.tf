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
