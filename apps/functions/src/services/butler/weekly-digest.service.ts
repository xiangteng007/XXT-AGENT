/**
 * Butler Weekly Digest Service
 * 
 * Generates a cross-domain weekly summary pushed to the user
 * every Sunday at 20:00 via LINE/Telegram.
 * 
 * Aggregates data from:
 *   - Finance: weekly spending vs previous week
 *   - Health: avg steps, weight trend, exercise minutes
 *   - Vehicle: fuel logs, maintenance reminders
 *   - Schedule: completed vs total events
 * 
 * Also generates AI-powered cross-domain insights.
 */

import { logger } from 'firebase-functions/v2';
import { financeService } from '../finance.service';
import { healthService } from '../health.service';
import { scheduleService } from '../schedule.service';
import { generateAIResponse } from '../butler-ai.service';
import { notificationService } from '../notification.service';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// ================================
// Types
// ================================

interface WeeklyDigest {
    weekStart: string;
    weekEnd: string;
    finance: {
        totalExpense: number;
        totalIncome: number;
        netSavings: number;
        topCategories: Array<{ category: string; amount: number }>;
        vsLastWeek: number; // percentage change
    };
    health: {
        avgSteps: number;
        avgSleepHours: number;
        totalExerciseMinutes: number;
        weightChange: number; // kg change from start to end of week
        latestWeight?: number;
    };
    vehicle: {
        fuelLogs: number;
        totalFuelCost: number;
        avgKmPerLiter?: number;
        urgentReminders: number;
    };
    schedule: {
        totalEvents: number;
        completedEvents: number;
        busiestDay: string;
    };
    insights: string[]; // AI-generated cross-domain insights
}

// ================================
// Generate Weekly Digest
// ================================

export async function generateWeeklyDigest(userId: string): Promise<WeeklyDigest> {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];
    const prevStartStr = prevWeekStart.toISOString().split('T')[0];

    // Parallel data fetching
    const [
        currentTx,
        prevTx,
        healthHistory,
        weightHistory,
        weekOverview,
    ] = await Promise.allSettled([
        financeService.getTransactions(userId, startStr, endStr),
        financeService.getTransactions(userId, prevStartStr, startStr),
        healthService.getHealthHistory(userId, startStr, endStr),
        healthService.getWeightHistory(userId, 14),
        scheduleService.getWeekOverview(userId),
    ]);

    // Finance - use any for flexible access since Transaction type varies
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txs: any[] = currentTx.status === 'fulfilled' ? currentTx.value : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevTxs: any[] = prevTx.status === 'fulfilled' ? prevTx.value : [];

    const totalExpense = txs
        .filter(t => t.type === 'expense')
        .reduce((sum: number, t) => sum + (t.amount || 0), 0);
    const totalIncome = txs
        .filter(t => t.type === 'income')
        .reduce((sum: number, t) => sum + (t.amount || 0), 0);
    const prevExpense = prevTxs
        .filter(t => t.type === 'expense')
        .reduce((sum: number, t) => sum + (t.amount || 0), 0);

    const categoryMap = new Map<string, number>();
    for (const tx of txs) {
        if (tx.type === 'expense') {
            const cat = tx.category || '未分類';
            const amt = tx.amount || 0;
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);
        }
    }
    const topCategories = Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, amount]) => ({ category, amount }));

    const vsLastWeek = prevExpense > 0
        ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100)
        : 0;

    // Health
    const healthData = healthHistory.status === 'fulfilled' ? healthHistory.value : [];
    const daysWithData = healthData.length || 1;
    const avgSteps = Math.round(
        healthData.reduce((s, d) => s + (d.steps || 0), 0) / daysWithData
    );
    const avgSleepHours = Math.round(
        healthData.reduce((s, d) => s + (d.sleepHours || 0), 0) / daysWithData * 10
    ) / 10;
    const totalExerciseMinutes = healthData.reduce(
        (s, d) => s + (d.activeMinutes || 0), 0
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weights: any[] = weightHistory.status === 'fulfilled' ? weightHistory.value : [];
    const latestWeight = weights.length > 0 ? weights[0].weight as number : undefined;
    const oldestWeight = weights.length > 1 ? weights[weights.length - 1].weight as number : latestWeight;
    const weightChange = latestWeight && oldestWeight ? Math.round((latestWeight - oldestWeight) * 10) / 10 : 0;

    // Vehicle — query fuel logs
    let fuelLogs = 0;
    let totalFuelCost = 0;
    try {
        const fuelSnap = await db.collection(`users/${userId}/vehicles/default/fuel_logs`)
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();
        fuelLogs = fuelSnap.size;
        fuelSnap.docs.forEach(doc => {
            const d = doc.data();
            totalFuelCost += (d.totalCost || (d.liters || 0) * (d.pricePerLiter || 0));
        });
    } catch { /* no vehicle data */ }

    // Schedule
    const overview = weekOverview.status === 'fulfilled' ? weekOverview.value : null;
    const totalEvents = overview?.summary?.totalEvents ?? 0;
    const busiestDay = overview?.summary?.busiestDay ?? '---';

    // Cross-domain insights via AI
    const insightPrompt = `根據以下個人數據，產生 3-5 條簡短的跨領域洞察建議（每條一行，以 emoji 開頭）：

財務：本週支出 $${totalExpense.toLocaleString()}（${vsLastWeek > 0 ? '↑' : '↓'}${Math.abs(vsLastWeek)}%），前三類：${topCategories.map(c => `${c.category} $${c.amount}`).join('、')}
健康：平均步數 ${avgSteps}，平均睡眠 ${avgSleepHours}h，運動 ${totalExerciseMinutes} 分鐘${latestWeight ? `，體重 ${latestWeight}kg（${weightChange > 0 ? '+' : ''}${weightChange}kg）` : ''}
車輛：加油 ${fuelLogs} 次，油費 $${totalFuelCost.toLocaleString()}
行程：${totalEvents} 個事件`;

    let insights: string[] = [];
    try {
        const aiInsights = await generateAIResponse(insightPrompt, userId);
        insights = aiInsights
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);
    } catch {
        insights = [
            totalExpense > totalIncome ? '💡 本週支出超過收入，注意預算控制' : '✅ 本週儲蓄表現良好',
            avgSteps < 5000 ? '🚶 步數偏低，試著多走動' : '🎯 步數達標，保持下去',
        ];
    }

    return {
        weekStart: startStr,
        weekEnd: endStr,
        finance: { totalExpense, totalIncome, netSavings: totalIncome - totalExpense, topCategories, vsLastWeek },
        health: { avgSteps, avgSleepHours, totalExerciseMinutes, weightChange, latestWeight },
        vehicle: { fuelLogs, totalFuelCost, urgentReminders: 0 },
        schedule: { totalEvents, completedEvents: 0, busiestDay },
        insights,
    };
}

// ================================
// Format Digest as Message
// ================================

export function formatDigestMessage(digest: WeeklyDigest): string {
    const { finance: f, health: h, vehicle: v, schedule: s, insights } = digest;
    const arrow = (n: number) => n > 0 ? `↑${n}%` : n < 0 ? `↓${Math.abs(n)}%` : '持平';
    const weightArrow = h.weightChange > 0 ? `+${h.weightChange}` : `${h.weightChange}`;

    let msg = `📊 本週小秘書摘要（${digest.weekStart} ~ ${digest.weekEnd}）\n\n`;
    msg += `💰 財務：支出 $${f.totalExpense.toLocaleString()}（較上週 ${arrow(f.vsLastWeek)}）\n`;
    if (f.topCategories.length > 0) {
        msg += `   Top: ${f.topCategories.map(c => `${c.category} $${c.amount.toLocaleString()}`).join(' / ')}\n`;
    }
    msg += `🏃 健康：平均步數 ${h.avgSteps.toLocaleString()}（目標 ${Math.round(h.avgSteps / 8000 * 100)}%）\n`;
    if (h.latestWeight) {
        msg += `   體重 ${h.latestWeight}kg（${weightArrow}kg）\n`;
    }
    msg += `   運動 ${h.totalExerciseMinutes} 分鐘 / 睡眠 ${h.avgSleepHours}h\n`;
    msg += `⛽ 車輛：加油 ${v.fuelLogs} 次 / 油費 $${v.totalFuelCost.toLocaleString()}\n`;
    msg += `📅 行程：${s.totalEvents} 個事件\n`;

    if (insights.length > 0) {
        msg += `\n💡 洞察：\n`;
        msg += insights.map(i => `  ${i}`).join('\n');
    }

    return msg;
}

// ================================
// Send Weekly Digest (called by Cloud Scheduler)
// ================================

export async function sendWeeklyDigests(): Promise<{ sent: number; errors: string[] }> {
    const result = { sent: 0, errors: [] as string[] };

    try {
        // Get all users with butler profiles
        const usersSnap = await db.collectionGroup('butler_preferences').get();
        const userIds = new Set<string>();

        for (const doc of usersSnap.docs) {
            // Path: users/{uid}/butler_preferences/settings
            const pathParts = doc.ref.path.split('/');
            if (pathParts.length >= 2) {
                userIds.add(pathParts[1]);
            }
        }

        logger.info(`[WeeklyDigest] Processing ${userIds.size} users`);

        for (const uid of userIds) {
            try {
                const digest = await generateWeeklyDigest(uid);
                const message = formatDigestMessage(digest);

                await notificationService.send({
                    userId: uid,
                    channel: 'line',
                    title: '本週摘要',
                    message,
                    category: 'alert',
                    priority: 'normal',
                });
                result.sent++;
            } catch (err) {
                const errorMsg = `User ${uid}: ${(err as Error).message}`;
                result.errors.push(errorMsg);
                logger.error(`[WeeklyDigest] ${errorMsg}`);
            }
        }
    } catch (err) {
        result.errors.push(`Global: ${(err as Error).message}`);
    }

    logger.info(`[WeeklyDigest] Sent: ${result.sent}, Errors: ${result.errors.length}`);
    return result;
}
