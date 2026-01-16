"""
Pub/Sub publisher for quote-normalizer.
"""
from google.cloud import pubsub_v1
import orjson


class PubSubPublisher:
    """Publishes JSON messages to Pub/Sub topics."""
    
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.client = pubsub_v1.PublisherClient()

    def publish_json(self, topic: str, payload: dict) -> None:
        """Publish a JSON payload to a Pub/Sub topic."""
        data = orjson.dumps(payload)
        topic_path = self.client.topic_path(self.project_id, topic)
        self.client.publish(topic_path, data=data)
