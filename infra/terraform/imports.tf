# Import blocks for Cloud Run services
#
# NOTE: Import blocks have been deliberately removed because:
# 1. All services already exist in GCP (xxt-agent project)
# 2. CI/CD runs without persistent Terraform state
# 3. Import blocks cause conflicts when state is not maintained
#
# If you need to import existing resources into a new Terraform state:
# Run locally with: terraform import google_cloud_run_v2_service.<name> <id>
#
# Example:
# terraform import google_cloud_run_v2_service.ai_gateway \
#   projects/xxt-agent/locations/asia-east1/services/ai-gateway
