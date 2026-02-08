/**
 * Butler Quick Commands Service
 * 
 * Parses natural language LINE messages into structured commands
 * and executes them against real Firestore data via domain services.
 * 
 * Supported commands:
 *   記帳 500 午餐     → record expense
 *   收入 50000 薪資   → record income
 *   體重 80.5         → record weight  
 *   步數 8500         → record steps
 *   加油 45L 32.5     → record fuel
 *   里程 16000        → update mileage
 *   明天 14:00 開會   → add event
 *   提醒 週五 繳房租  → add reminder
 */

import { financeService } from '../finance.service';
import { healthService } from '../health.service';
import { vehicleService } from '../vehicle.service';
import { scheduleService } from '../schedule.service';

// ================================
// Types
// ================================

export interface ParsedCommand {
    action: string;
    params: Record<string, unknown>;
    confidence: number;
    display: string; // Human-readable description
}

// ================================
// Command Patterns (zh-TW)
// ================================

const COMMAND_PATTERNS: Array<{
    pattern: RegExp;
    action: string;
    extract: (match: RegExpMatchArray) => Record<string, unknown>;
    display: (params: Record<string, unknown>) => string;
}> = [
    // 記帳 500 午餐 | 花了 200 交通 | 支出 1200 購物
    {
        pattern: /^(?:記帳|花了|支出|花費|消費)\s*(\d+(?:\.\d+)?)\s*(.+)?$/,
        action: 'record_expense',
        extract: (m) => ({
            amount: parseFloat(m[1]),
            description: m[2]?.trim() || '未分類',
        }),
        display: (p) => `💳 支出 $${p.amount} (${p.description})`,
    },
    // 收入 50000 薪資
    {
        pattern: /^(?:收入|進帳|入帳)\s*(\d+(?:\.\d+)?)\s*(.+)?$/,
        action: 'record_income',
        extract: (m) => ({
            amount: parseFloat(m[1]),
            description: m[2]?.trim() || '其他收入',
        }),
        display: (p) => `💰 收入 $${p.amount} (${p.description})`,
    },
    // 體重 80.5 | 體重80.5
    {
        pattern: /^體重\s*(\d+(?:\.\d+)?)\s*(?:kg|公斤)?$/i,
        action: 'record_weight',
        extract: (m) => ({ value: parseFloat(m[1]) }),
        display: (p) => `⚖️ 體重 ${p.value}kg`,
    },
    // 步數 8500
    {
        pattern: /^(?:步數|走了|走路)\s*(\d+)\s*(?:步)?$/,
        action: 'record_steps',
        extract: (m) => ({ steps: parseInt(m[1], 10) }),
        display: (p) => `🚶 步數 ${p.steps}`,
    },
    // 加油 45L 32.5 | 加油 45公升 32.5
    {
        pattern: /^加油\s*(\d+(?:\.\d+)?)\s*(?:L|公升|升)\s*(\d+(?:\.\d+)?)?/i,
        action: 'record_fuel',
        extract: (m) => ({
            liters: parseFloat(m[1]),
            pricePerLiter: m[2] ? parseFloat(m[2]) : undefined,
        }),
        display: (p) => `⛽ 加油 ${p.liters}L${p.pricePerLiter ? ` @$${p.pricePerLiter}` : ''}`,
    },
    // 里程 16000
    {
        pattern: /^(?:里程|目前里程|公里數)\s*(\d+)\s*(?:km|公里)?$/i,
        action: 'record_mileage',
        extract: (m) => ({ mileage: parseInt(m[1], 10) }),
        display: (p) => `🚗 里程 ${p.mileage}km`,
    },
    // 明天 14:00 開會 | 後天 10:30 看牙醫
    {
        pattern: /^(今天|明天|後天|下週[一二三四五六日]?|週[一二三四五六日])\s*(\d{1,2}[:.]\d{2})?\s*(.+)$/,
        action: 'add_event',
        extract: (m) => ({
            dayRef: m[1],
            time: m[2]?.replace('.', ':'),
            title: m[3]?.trim(),
        }),
        display: (p) => `📅 ${p.dayRef}${p.time ? ' ' + p.time : ''} ${p.title}`,
    },
    // 提醒 週五 繳房租 | 提醒我 明天 買牛奶
    {
        pattern: /^提醒(?:我)?\s*(今天|明天|後天|下週[一二三四五六日]?|週[一二三四五六日]|\d+[:.]\d{2})?\s*(.+)$/,
        action: 'add_reminder',
        extract: (m) => ({
            when: m[1]?.trim(),
            title: m[2]?.trim(),
        }),
        display: (p) => `⏰ 提醒：${p.title}${p.when ? ' (' + p.when + ')' : ''}`,
    },
];

// ================================
// Parse Command
// ================================

export function parseCommand(text: string): ParsedCommand | null {
    const trimmed = text.trim();

    for (const { pattern, action, extract, display } of COMMAND_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
            const params = extract(match);
            return {
                action,
                params,
                confidence: 0.9,
                display: display(params),
            };
        }
    }

    return null;
}

// ================================
// Execute Command
// ================================

export async function executeCommand(
    userId: string,
    cmd: ParsedCommand
): Promise<string> {
    try {
        switch (cmd.action) {
            case 'record_expense': {
                const { amount, description } = cmd.params as { amount: number; description: string };
                const category = financeService.categorizeTransaction(description as string);
                await financeService.recordTransaction(userId, {
                    type: 'expense',
                    amount,
                    description: description as string,
                    category: category.category,
                    date: new Date().toISOString(),
                    source: 'manual',
                    bankAccountId: '',
                });
                return `✅ 已記錄支出 $${amount.toLocaleString()} (${category.category})\n📝 ${description}\n\n回覆「取消」可撤銷`;
            }

            case 'record_income': {
                const { amount, description } = cmd.params as { amount: number; description: string };
                await financeService.recordTransaction(userId, {
                    type: 'income',
                    amount,
                    description: description as string,
                    category: description as string,
                    date: new Date().toISOString(),
                    source: 'manual',
                    bankAccountId: '',
                });
                return `✅ 已記錄收入 $${amount.toLocaleString()}\n📝 ${description}`;
            }

            case 'record_weight': {
                const { value } = cmd.params as { value: number };
                await healthService.recordWeight(userId, value);
                return `✅ 已記錄體重 ${value}kg\n📊 趨勢分析請說「體重紀錄」`;
            }

            case 'record_steps': {
                const { steps } = cmd.params as { steps: number };
                const today = new Date().toISOString().split('T')[0];
                await healthService.recordDailyHealth(userId, {
                    date: today,
                    steps,
                });
                const goal = 8000;
                const pct = Math.round((steps / goal) * 100);
                const bar = pct >= 100 ? '🎉 達標！' : `${pct}% of 目標`;
                return `✅ 已記錄步數 ${steps.toLocaleString()}\n🎯 ${bar}`;
            }

            case 'record_fuel': {
                const { liters, pricePerLiter } = cmd.params as {
                    liters: number;
                    pricePerLiter?: number;
                };
                await vehicleService.recordFuel(userId, 'default', {
                    mileage: 0, // User should provide via 里程 command
                    liters,
                    pricePerLiter: pricePerLiter ?? 0,
                    isFull: true,
                });
                const cost = pricePerLiter ? liters * pricePerLiter : 0;
                return `✅ 已記錄加油 ${liters}L${cost > 0 ? ` ($${cost.toFixed(0)})` : ''}\n💡 搭配「里程」指令可計算油耗`;
            }

            case 'record_mileage': {
                const { mileage } = cmd.params as { mileage: number };
                // Update vehicle profile mileage
                const vehicleRef = `users/${userId}/vehicles/default`;
                const admin = await import('firebase-admin');
                await admin.firestore().doc(vehicleRef).update({
                    currentMileage: mileage,
                    updatedAt: admin.firestore.Timestamp.now(),
                });
                return `✅ 里程已更新至 ${mileage.toLocaleString()}km`;
            }

            case 'add_event': {
                const { dayRef, time, title } = cmd.params as {
                    dayRef: string;
                    time?: string;
                    title: string;
                };
                const eventDate = resolveDate(dayRef as string);
                if (time) {
                    const [h, m] = (time as string).split(':').map(Number);
                    eventDate.setHours(h, m, 0, 0);
                }
                const endDate = new Date(eventDate);
                endDate.setHours(endDate.getHours() + 1);

                await scheduleService.addEvent(userId, {
                    title: title as string,
                    start: eventDate,
                    end: endDate,
                    allDay: !time,
                    category: 'personal',
                    reminders: [{ type: 'line', minutesBefore: 30 }],
                    source: 'line',
                });
                const dateStr = eventDate.toLocaleDateString('zh-TW', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                });
                return `✅ 已新增行程\n📅 ${dateStr}${time ? ' ' + time : ''}\n📝 ${title}`;
            }

            case 'add_reminder': {
                const { when, title } = cmd.params as { when?: string; title: string };
                const dueDate = when ? resolveDate(when) : new Date();
                dueDate.setHours(9, 0, 0, 0); // Default reminder at 9am

                const admin = await import('firebase-admin');
                await admin.firestore().collection(`users/${userId}/butler/reminders`).add({
                    title,
                    dueDate: dueDate.toISOString().split('T')[0],
                    completed: false,
                    source: 'line_butler',
                    createdAt: admin.firestore.Timestamp.now(),
                });
                return `✅ 提醒已設定\n⏰ ${dueDate.toLocaleDateString('zh-TW')}\n📝 ${title}`;
            }

            default:
                return `❓ 不支援的指令類型：${cmd.action}`;
        }
    } catch (error) {
        console.error(`[Butler] Command execution failed:`, error);
        return `⚠️ 執行失敗，請稍後再試。\n指令：${cmd.display}`;
    }
}

// ================================
// Date Resolution Helper
// ================================

function resolveDate(ref: string): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayMap: Record<string, number> = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0,
    };

    switch (ref) {
        case '今天':
            return new Date(today);
        case '明天': {
            const d = new Date(today);
            d.setDate(d.getDate() + 1);
            return d;
        }
        case '後天': {
            const d = new Date(today);
            d.setDate(d.getDate() + 2);
            return d;
        }
        default: {
            // 週X or 下週X
            const isNextWeek = ref.startsWith('下週');
            const dayChar = ref.replace('下週', '').replace('週', '');
            const targetDay = dayMap[dayChar] ?? today.getDay();
            const d = new Date(today);
            let daysAhead = targetDay - today.getDay();
            if (daysAhead <= 0) daysAhead += 7;
            if (isNextWeek) daysAhead += 7;
            d.setDate(d.getDate() + daysAhead);
            return d;
        }
    }
}
