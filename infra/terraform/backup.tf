# ---------------------------------------------------------
# Firestore Backup Bucket (DE-01)
# ---------------------------------------------------------

resource "random_string" "bucket_suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "google_storage_bucket" "firestore_backups" {
  name          = "${var.project_id}-firestore-backups-${random_string.bucket_suffix.result}"
  location      = "asia-east1" # Should match Firestore location
  force_destroy = false

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    condition {
      age = 30 # 保留 30 天
    }
    action {
      type = "Delete"
    }
  }
}

# Grant the default Cloud Functions service account or Firestore admin permissions to write to this bucket
resource "google_storage_bucket_iam_member" "firestore_backup_writer" {
  bucket = google_storage_bucket.firestore_backups.name
  role   = "roles/storage.objectAdmin"
  # Replace with appropriate service account (App Engine default or custom SA running the function)
  member = "serviceAccount:${var.project_id}@appspot.gserviceaccount.com"
}
