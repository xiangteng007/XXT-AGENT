"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishJson = publishJson;
exports.parseMessageData = parseMessageData;
const pubsub_1 = require("@google-cloud/pubsub");
async function publishJson(projectId, topicName, payload) {
    const pubsub = new pubsub_1.PubSub({ projectId });
    const topic = pubsub.topic(topicName);
    const data = Buffer.from(JSON.stringify(payload), "utf-8");
    const messageId = await topic.publishMessage({ data });
    return messageId;
}
function parseMessageData(data) {
    return JSON.parse(data.toString("utf-8"));
}
