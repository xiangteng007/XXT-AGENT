# Cloud Tasks Queue - Deprecated
#
# This file previously defined Cloud Tasks queues for the social collection pipeline.
# The queue and related resources are currently not deployed/managed by Terraform.
#
# If you need to manage Cloud Tasks via Terraform, ensure:
# 1. Cloud Tasks API is enabled in the target project
# 2. The import block references an existing queue
#
# Example configuration (commented out):
# resource "google_cloud_tasks_queue" "social_collect" {
#   name     = "social-collect-queue"
#   location = var.region
#
#   rate_limits {
#     max_dispatches_per_second = 5
#     max_concurrent_dispatches = 20
#   }
#
#   retry_config {
#     max_attempts  = 8
#     max_backoff   = "60s"
#     min_backoff   = "1s"
#     max_doublings = 6
#   }
# }
