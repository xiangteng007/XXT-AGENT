"""
Pub/Sub publisher for news-collector.
Gracefully handles missing topics or permissions.
"""
from google.cloud import pubsub_v1
import orjson
import logging

logger = logging.getLogger("news-collector")


class PubSubPublisher:
    """Publishes JSON messages to Pub/Sub topics."""
    
    def __init__(self, project_id: str):
        self.project_id = project_id
        self._client = None
        self._enabled = True
        
        if not project_id:
            logger.warning("No GCP_PROJECT_ID set, Pub/Sub disabled")
            self._enabled = False
            return
            
        try:
            self._client = pubsub_v1.PublisherClient()
            logger.info("Pub/Sub client initialized")
        except Exception as e:
            logger.warning(f"Failed to create Pub/Sub client: {e}")
            self._enabled = False

    def publish_json(self, topic: str, payload: dict) -> None:
        """Publish a JSON payload to a Pub/Sub topic (best effort)."""
        if not self._enabled or not self._client or not topic:
            return
            
        try:
            data = orjson.dumps(payload)
            topic_path = self._client.topic_path(self.project_id, topic)
            self._client.publish(topic_path, data=data)
        except Exception as e:
            logger.warning(f"Pub/Sub publish failed (continuing): {e}")
