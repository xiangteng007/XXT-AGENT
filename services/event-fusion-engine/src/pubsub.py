"""
Pub/Sub publisher for event-fusion-engine.
"""
from google.cloud import pubsub_v1
import orjson


class PubSubPublisher:
    """Publishes JSON messages to Pub/Sub topics with attributes."""
    
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.client = pubsub_v1.PublisherClient()

    def publish_json(self, topic: str, payload: dict, attributes: dict = None) -> None:
        """Publish a JSON payload with optional attributes."""
        data = orjson.dumps(payload)
        topic_path = self.client.topic_path(self.project_id, topic)
        
        # Include event_type as attribute for subscription filtering
        attrs = attributes or {}
        if "event_type" in payload:
            attrs["event_type"] = payload["event_type"]
        
        self.client.publish(topic_path, data=data, **attrs)
