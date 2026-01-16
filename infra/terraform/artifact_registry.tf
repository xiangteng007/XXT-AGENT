resource "google_artifact_registry_repository" "repo" {
  repository_id = "ai-me-services"
  location      = var.region
  format        = "DOCKER"
  description   = "AI ME cloud run services"
}
