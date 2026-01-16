/**
 * LINE Webhook Event Types
 * @see https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects
 */

export interface LineWebhookBody {
    destination: string;
    events: LineEvent[];
}

export type LineEvent =
    | LineMessageEvent
    | LineFollowEvent
    | LineUnfollowEvent
    | LineJoinEvent
    | LineLeaveEvent;

export interface LineEventBase {
    type: string;
    timestamp: number;
    source: LineEventSource;
    webhookEventId: string;
    deliveryContext: {
        isRedelivery: boolean;
    };
    mode: 'active' | 'standby';
}

export interface LineMessageEvent extends LineEventBase {
    type: 'message';
    replyToken: string;
    message: LineMessage;
}

export interface LineFollowEvent extends LineEventBase {
    type: 'follow';
    replyToken: string;
}

export interface LineUnfollowEvent extends LineEventBase {
    type: 'unfollow';
}

export interface LineJoinEvent extends LineEventBase {
    type: 'join';
    replyToken: string;
}

export interface LineLeaveEvent extends LineEventBase {
    type: 'leave';
}

export type LineEventSource =
    | LineUserSource
    | LineGroupSource
    | LineRoomSource;

export interface LineUserSource {
    type: 'user';
    userId: string;
}

export interface LineGroupSource {
    type: 'group';
    groupId: string;
    userId?: string;
}

export interface LineRoomSource {
    type: 'room';
    roomId: string;
    userId?: string;
}

export type LineMessage =
    | LineTextMessage
    | LineImageMessage
    | LineLocationMessage
    | LineStickerMessage;

export interface LineTextMessage {
    id: string;
    type: 'text';
    text: string;
    emojis?: LineEmoji[];
    mention?: LineMention;
}

export interface LineImageMessage {
    id: string;
    type: 'image';
    contentProvider: {
        type: 'line' | 'external';
        originalContentUrl?: string;
        previewImageUrl?: string;
    };
}

export interface LineLocationMessage {
    id: string;
    type: 'location';
    title: string;
    address: string;
    latitude: number;
    longitude: number;
}

export interface LineStickerMessage {
    id: string;
    type: 'sticker';
    packageId: string;
    stickerId: string;
}

export interface LineEmoji {
    index: number;
    length: number;
    productId: string;
    emojiId: string;
}

export interface LineMention {
    mentionees: Array<{
        index: number;
        length: number;
        userId?: string;
        type: 'user' | 'all';
    }>;
}

// Reply message types
export interface LineReplyMessage {
    replyToken: string;
    messages: LineSendMessage[];
}

export type LineSendMessage =
    | LineTextSendMessage
    | LineFlexSendMessage;

export interface LineTextSendMessage {
    type: 'text';
    text: string;
}

export interface LineFlexSendMessage {
    type: 'flex';
    altText: string;
    contents: Record<string, unknown>;
}
