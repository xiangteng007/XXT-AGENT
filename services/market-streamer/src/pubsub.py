"""
Google Cloud Pub/Sub publisher utility.
"""
from __future__ import annotations
from google.cloud import pubsub_v1
import orjson


class PubSubPublisher:
    """Async-friendly Pub/Sub publisher with JSON serialization."""
    
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.client = pubsub_v1.PublisherClient()

    def topic_path(self, topic_name: str) -> str:
        """Get full topic path from topic name."""
        return self.client.topic_path(self.project_id, topic_name)

    def publish_json(self, topic_name: str, payload: dict) -> None:
        """
        Publish a JSON payload to a Pub/Sub topic.
        
        Uses orjson for fast serialization. Fire-and-forget pattern.
        """
        data = orjson.dumps(payload)
        topic_path = self.topic_path(topic_name)
        future = self.client.publish(topic_path, data=data)
        # Fire-and-forget; callback can be added for error handling
        _ = future
