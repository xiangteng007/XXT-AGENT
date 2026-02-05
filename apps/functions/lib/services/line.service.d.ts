import { LineTextSendMessage } from '../types';
/**
 * Verify LINE webhook signature
 */
export declare function verifySignature(body: string, signature: string, channelSecret: string): boolean;
/**
 * Send reply message to LINE
 */
export declare function replyMessage(replyToken: string, integrationId: string, messages: string | LineTextSendMessage[]): Promise<boolean>;
/**
 * Get user profile from LINE
 */
export declare function getUserProfile(userId: string, integrationId: string): Promise<{
    displayName: string;
    pictureUrl?: string;
} | null>;
/**
 * Get binary content (image/video) from LINE
 */
export declare function getMessageContent(messageId: string, integrationId: string): Promise<Buffer | null>;
//# sourceMappingURL=line.service.d.ts.map