/**
 * Memory Organizer Scheduled Jobs
 *
 * Layer B — 每日凌晨 2:00 執行自動日報
 * Layer C — 每週日凌晨 2:30 執行跨域洞察
 */

import { logger } from 'firebase-functions/v2';
import {
    runDailySummary,
    runCrossdomainInsights,
    getActiveUserIds,
} from '../services/memory-organizer.service';
import { withLock } from '../utils/distributed-lock';

export async function runMemoryOrganizerDaily(): Promise<void> {
    await withLock({ name: 'memory-organizer-daily', ttlSeconds: 600 }, async () => {
        logger.info('[MemoryOrganizer] Starting daily summary job');

        const userIds = await getActiveUserIds();
        if (userIds.length === 0) {
            logger.info('[MemoryOrganizer] No active users, skipping');
            return;
        }

        const results = await runDailySummary(userIds);
        const saved = results.reduce((s, r) => s + r.summariesSaved, 0);
        const skipped = results.filter(r => r.skippedReason).length;

        logger.info('[MemoryOrganizer] Daily summary complete', {
            users: userIds.length,
            summariesSaved: saved,
            skipped,
        });
    });
}

export async function runMemoryOrganizerWeekly(): Promise<void> {
    await withLock({ name: 'memory-organizer-weekly', ttlSeconds: 900 }, async () => {
        logger.info('[MemoryOrganizer] Starting weekly cross-domain insights');

        const userIds = await getActiveUserIds();
        if (userIds.length === 0) {
            logger.info('[MemoryOrganizer] No active users, skipping');
            return;
        }

        let totalInsights = 0;
        for (const userId of userIds) {
            const count = await runCrossdomainInsights(userId);
            totalInsights += count;
        }

        logger.info('[MemoryOrganizer] Weekly insights complete', {
            users: userIds.length,
            insightsGenerated: totalInsights,
        });
    });
}
