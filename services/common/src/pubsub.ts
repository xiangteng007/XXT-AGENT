import { PubSub } from "@google-cloud/pubsub";

export async function publishJson(projectId: string, topicName: string, payload: any): Promise<string> {
  const pubsub = new PubSub({ projectId });
  const topic = pubsub.topic(topicName);
  const data = Buffer.from(JSON.stringify(payload), "utf-8");
  const messageId = await topic.publishMessage({ data });
  return messageId;
}

export function parseMessageData(data: Buffer): any {
  return JSON.parse(data.toString("utf-8"));
}
