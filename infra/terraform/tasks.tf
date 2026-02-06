# Cloud Tasks Queue for Social Collection
# Reference to existing queue (data source not supported for Cloud Tasks)
# The queue "social-collect-queue" already exists in GCP

locals {
  social_task_queue_name = "social-collect-queue"
}

# Note: The actual Cloud Tasks queue resource is managed outside of Terraform
# because the google provider does not support:
# 1. A data source for cloud tasks queues
# 2. Idempotent operations (returns 409 if queue exists)
#
# To manage the queue, use gcloud CLI:
# gcloud tasks queues create social-collect-queue --location=asia-east1
