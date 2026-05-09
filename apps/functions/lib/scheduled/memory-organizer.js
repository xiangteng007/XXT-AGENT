"use strict";
/**
 * Memory Organizer Scheduled Jobs
 *
 * Layer B — 每日凌晨 2:00 執行自動日報
 * Layer C — 每週日凌晨 2:30 執行跨域洞察
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMemoryOrganizerDaily = runMemoryOrganizerDaily;
exports.runMemoryOrganizerWeekly = runMemoryOrganizerWeekly;
const v2_1 = require("firebase-functions/v2");
const memory_organizer_service_1 = require("../services/memory-organizer.service");
const distributed_lock_1 = require("../utils/distributed-lock");
async function runMemoryOrganizerDaily() {
    await (0, distributed_lock_1.withLock)({ name: 'memory-organizer-daily', ttlSeconds: 600 }, async () => {
        v2_1.logger.info('[MemoryOrganizer] Starting daily summary job');
        const userIds = await (0, memory_organizer_service_1.getActiveUserIds)();
        if (userIds.length === 0) {
            v2_1.logger.info('[MemoryOrganizer] No active users, skipping');
            return;
        }
        const results = await (0, memory_organizer_service_1.runDailySummary)(userIds);
        const saved = results.reduce((s, r) => s + r.summariesSaved, 0);
        const skipped = results.filter(r => r.skippedReason).length;
        v2_1.logger.info('[MemoryOrganizer] Daily summary complete', {
            users: userIds.length,
            summariesSaved: saved,
            skipped,
        });
    });
}
async function runMemoryOrganizerWeekly() {
    await (0, distributed_lock_1.withLock)({ name: 'memory-organizer-weekly', ttlSeconds: 900 }, async () => {
        v2_1.logger.info('[MemoryOrganizer] Starting weekly cross-domain insights');
        const userIds = await (0, memory_organizer_service_1.getActiveUserIds)();
        if (userIds.length === 0) {
            v2_1.logger.info('[MemoryOrganizer] No active users, skipping');
            return;
        }
        let totalInsights = 0;
        for (const userId of userIds) {
            const count = await (0, memory_organizer_service_1.runCrossdomainInsights)(userId);
            totalInsights += count;
        }
        v2_1.logger.info('[MemoryOrganizer] Weekly insights complete', {
            users: userIds.length,
            insightsGenerated: totalInsights,
        });
    });
}
//# sourceMappingURL=memory-organizer.js.map