# Cloud Tasks Queue for Social Collection
# Using data source to reference existing queue (avoids 409 conflict)

data "google_cloud_tasks_queue" "social_collect" {
  name     = "social-collect-queue"
  location = "asia-east1"
}

# For use in other resources that reference this queue
locals {
  social_task_queue_name = data.google_cloud_tasks_queue.social_collect.name
}
