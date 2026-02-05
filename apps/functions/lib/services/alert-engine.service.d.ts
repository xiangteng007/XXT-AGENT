/**
 * Alert Engine Service
 *
 * Sends notifications based on fused events and notification settings.
 * Supports: Telegram, LINE, Webhook, Email, Slack
 */
import { FusedEvent } from '../types/social.types';
/**
 * Process and send alerts for a fused event
 */
export declare function sendAlertsForEvent(event: FusedEvent): Promise<{
    sent: number;
    failed: number;
    channels: string[];
}>;
//# sourceMappingURL=alert-engine.service.d.ts.map