"use strict";
/**
 * LINE Flex Message Builder
 *
 * Creates rich Flex Message cards for the 小秘書 Butler bot.
 * Supports finance summaries, health reports, schedule views,
 * and vehicle status cards.
 *
 * @see https://developers.line.biz/en/docs/messaging-api/flex-message-elements/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFinanceSummaryCard = buildFinanceSummaryCard;
exports.buildHealthSummaryCard = buildHealthSummaryCard;
exports.buildVehicleStatusCard = buildVehicleStatusCard;
exports.buildScheduleCard = buildScheduleCard;
exports.buildQuickReplyButtons = buildQuickReplyButtons;
exports.detectDomain = detectDomain;
// ================================
// Color Palette
// ================================
const COLORS = {
    primary: '#1DB446', // 綠色 - 正面/健康
    danger: '#DD2C00', // 紅色 - 警告/支出
    info: '#2196F3', // 藍色 - 資訊
    warning: '#FF9800', // 橘色 - 提醒
    dark: '#1A1A1A', // 深色標題
    muted: '#888888', // 次要文字
    separator: '#EEEEEE', // 分隔線
    bgLight: '#F8F9FA', // 淺色背景
    bgDark: '#2D3436', // 深色頭部
    white: '#FFFFFF',
};
// ================================
// Finance Card
// ================================
function buildFinanceSummaryCard(data) {
    const balance = data.totalIncome - data.totalExpense;
    const trendEmoji = data.trend === 'up' ? '📈' : data.trend === 'down' ? '📉' : '➡️';
    return {
        type: 'flex',
        altText: `💰 ${data.monthLabel} 財務摘要：支出 NT$${data.totalExpense.toLocaleString()}`,
        contents: {
            type: 'bubble',
            styles: {
                header: { backgroundColor: COLORS.bgDark },
            },
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: '💰 財務報表', color: COLORS.white, size: 'lg', weight: 'bold' },
                    { type: 'text', text: data.monthLabel, color: '#AAAAAA', size: 'xs', margin: 'sm' },
                ],
                paddingAll: '16px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    // Summary Row
                    {
                        type: 'box', layout: 'horizontal', contents: [
                            { type: 'text', text: '收入', size: 'sm', color: COLORS.muted, flex: 1 },
                            { type: 'text', text: `NT$${data.totalIncome.toLocaleString()}`, size: 'sm', color: COLORS.primary, align: 'end', flex: 2, weight: 'bold' },
                        ],
                    },
                    {
                        type: 'box', layout: 'horizontal', contents: [
                            { type: 'text', text: '支出', size: 'sm', color: COLORS.muted, flex: 1 },
                            { type: 'text', text: `NT$${data.totalExpense.toLocaleString()}`, size: 'sm', color: COLORS.danger, align: 'end', flex: 2, weight: 'bold' },
                        ], margin: 'md',
                    },
                    { type: 'separator', margin: 'lg', color: COLORS.separator },
                    {
                        type: 'box', layout: 'horizontal', contents: [
                            { type: 'text', text: '結餘', size: 'md', weight: 'bold', flex: 1 },
                            { type: 'text', text: `${trendEmoji} NT$${balance.toLocaleString()}`, size: 'md', weight: 'bold', align: 'end', flex: 2, color: balance >= 0 ? COLORS.primary : COLORS.danger },
                        ], margin: 'lg',
                    },
                    // Top Categories
                    { type: 'separator', margin: 'lg', color: COLORS.separator },
                    { type: 'text', text: '📊 支出分類 Top 3', size: 'xs', color: COLORS.muted, margin: 'lg' },
                    ...data.topCategories.slice(0, 3).map(cat => ({
                        type: 'box', layout: 'horizontal', contents: [
                            { type: 'text', text: `${cat.emoji} ${cat.name}`, size: 'sm', flex: 2 },
                            { type: 'text', text: `NT$${cat.amount.toLocaleString()}`, size: 'sm', align: 'end', flex: 1, color: COLORS.muted },
                        ], margin: 'sm',
                    })),
                ],
                paddingAll: '16px',
                spacing: 'sm',
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'button', style: 'primary', action: {
                            type: 'postback', label: '📝 記帳', data: 'action=add_expense',
                        },
                    },
                    {
                        type: 'button', style: 'link', action: {
                            type: 'postback', label: '📊 詳細報表', data: 'action=finance_detail',
                        },
                    },
                ],
                spacing: 'sm',
                paddingAll: '12px',
            },
        },
    };
}
// ================================
// Health Card
// ================================
function buildHealthSummaryCard(data) {
    const stepsProgress = Math.min(100, Math.round((data.steps / data.stepsGoal) * 100));
    const stepsColor = stepsProgress >= 100 ? COLORS.primary : stepsProgress >= 60 ? COLORS.warning : COLORS.danger;
    return {
        type: 'flex',
        altText: `🏃 今日健康：${data.steps.toLocaleString()} 步`,
        contents: {
            type: 'bubble',
            styles: {
                header: { backgroundColor: '#00695C' },
            },
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: '🏃 健康日報', color: COLORS.white, size: 'lg', weight: 'bold' },
                    { type: 'text', text: data.date, color: '#80CBC4', size: 'xs', margin: 'sm' },
                ],
                paddingAll: '16px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    // Steps highlight
                    {
                        type: 'box', layout: 'vertical', contents: [
                            { type: 'text', text: `${data.steps.toLocaleString()} 步`, size: 'xxl', weight: 'bold', align: 'center', color: stepsColor },
                            { type: 'text', text: `目標 ${data.stepsGoal.toLocaleString()} 步 (${stepsProgress}%)`, size: 'xs', align: 'center', color: COLORS.muted },
                        ],
                    },
                    { type: 'separator', margin: 'lg', color: COLORS.separator },
                    // Metrics Grid
                    {
                        type: 'box', layout: 'horizontal', contents: [
                            {
                                type: 'box', layout: 'vertical', contents: [
                                    { type: 'text', text: '🔥 卡路里', size: 'xxs', color: COLORS.muted, align: 'center' },
                                    { type: 'text', text: `${data.calories}`, size: 'md', weight: 'bold', align: 'center' },
                                ], flex: 1,
                            },
                            {
                                type: 'box', layout: 'vertical', contents: [
                                    { type: 'text', text: '⏱️ 活動', size: 'xxs', color: COLORS.muted, align: 'center' },
                                    { type: 'text', text: `${data.activeMinutes}m`, size: 'md', weight: 'bold', align: 'center' },
                                ], flex: 1,
                            },
                            {
                                type: 'box', layout: 'vertical', contents: [
                                    { type: 'text', text: '😴 睡眠', size: 'xxs', color: COLORS.muted, align: 'center' },
                                    { type: 'text', text: `${data.sleepHours}h`, size: 'md', weight: 'bold', align: 'center' },
                                ], flex: 1,
                            },
                        ], margin: 'lg', spacing: 'sm',
                    },
                    // Optional metrics
                    ...(data.heartRate || data.weight ? [
                        { type: 'separator', margin: 'lg', color: COLORS.separator },
                        {
                            type: 'box', layout: 'horizontal', contents: [
                                ...(data.heartRate ? [{ type: 'text', text: `❤️ ${data.heartRate} bpm`, size: 'sm', flex: 1 }] : []),
                                ...(data.weight ? [{ type: 'text', text: `⚖️ ${data.weight} kg`, size: 'sm', align: 'end', flex: 1 }] : []),
                            ], margin: 'md',
                        },
                    ] : []),
                ],
                paddingAll: '16px',
                spacing: 'sm',
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'button', style: 'primary', action: {
                            type: 'postback', label: '📊 週報', data: 'action=health_weekly',
                        },
                    },
                    {
                        type: 'button', style: 'link', action: {
                            type: 'postback', label: '⚖️ 記錄體重', data: 'action=log_weight',
                        },
                    },
                ],
                spacing: 'sm',
                paddingAll: '12px',
            },
        },
    };
}
// ================================
// Vehicle Status Card
// ================================
function buildVehicleStatusCard(data) {
    const serviceRemaining = data.nextServiceMileage - data.mileage;
    const serviceUrgent = serviceRemaining <= 500;
    return {
        type: 'flex',
        altText: `🚗 ${data.make} ${data.model} 狀態`,
        contents: {
            type: 'bubble',
            styles: {
                header: { backgroundColor: '#37474F' },
            },
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: `🚗 ${data.make} ${data.model} ${data.variant}`, color: COLORS.white, size: 'md', weight: 'bold' },
                    { type: 'text', text: data.licensePlate, color: '#90A4AE', size: 'xs', margin: 'sm' },
                ],
                paddingAll: '16px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    // Mileage
                    {
                        type: 'box', layout: 'horizontal', contents: [
                            { type: 'text', text: '🛣️ 里程', size: 'sm', color: COLORS.muted, flex: 1 },
                            { type: 'text', text: `${data.mileage.toLocaleString()} km`, size: 'sm', weight: 'bold', align: 'end', flex: 2 },
                        ],
                    },
                    // Next service
                    {
                        type: 'box', layout: 'horizontal', contents: [
                            { type: 'text', text: '🔧 下次保養', size: 'sm', color: COLORS.muted, flex: 1 },
                            { type: 'text', text: serviceUrgent ? `⚠️ 剩 ${serviceRemaining} km` : `剩 ${serviceRemaining.toLocaleString()} km`, size: 'sm', weight: 'bold', align: 'end', flex: 2, color: serviceUrgent ? COLORS.danger : COLORS.dark },
                        ], margin: 'md',
                    },
                    { type: 'separator', margin: 'lg', color: COLORS.separator },
                    // Insurance & Inspection
                    {
                        type: 'box', layout: 'horizontal', contents: [
                            { type: 'text', text: '🛡️ 保險到期', size: 'sm', color: COLORS.muted, flex: 1 },
                            { type: 'text', text: data.insuranceExpiry, size: 'sm', align: 'end', flex: 2 },
                        ], margin: 'lg',
                    },
                    {
                        type: 'box', layout: 'horizontal', contents: [
                            { type: 'text', text: '📋 驗車到期', size: 'sm', color: COLORS.muted, flex: 1 },
                            { type: 'text', text: data.inspectionExpiry, size: 'sm', align: 'end', flex: 2 },
                        ], margin: 'md',
                    },
                    // Fuel efficiency
                    ...(data.lastFuelEfficiency ? [{
                            type: 'separator', margin: 'lg', color: COLORS.separator,
                        }, {
                            type: 'box', layout: 'horizontal', contents: [
                                { type: 'text', text: '⛽ 油耗', size: 'sm', color: COLORS.muted, flex: 1 },
                                { type: 'text', text: `${data.lastFuelEfficiency} km/L`, size: 'sm', weight: 'bold', align: 'end', flex: 2 },
                            ], margin: 'lg',
                        }] : []),
                ],
                paddingAll: '16px',
                spacing: 'sm',
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'button', style: 'primary', action: {
                            type: 'postback', label: '⛽ 記錄加油', data: 'action=log_fuel',
                        },
                    },
                    {
                        type: 'button', style: 'link', action: {
                            type: 'postback', label: '🔧 保養紀錄', data: 'action=maintenance_log',
                        },
                    },
                ],
                spacing: 'sm',
                paddingAll: '12px',
            },
        },
    };
}
// ================================
// Schedule Card (Timeline)
// ================================
function buildScheduleCard(data) {
    const eventContents = data.events.length === 0
        ? [{ type: 'text', text: '📭 今天沒有排定的行程', size: 'sm', color: COLORS.muted, align: 'center', margin: 'xl' }]
        : data.events.map((ev, idx) => ({
            type: 'box',
            layout: 'horizontal',
            contents: [
                { type: 'text', text: ev.time, size: 'sm', color: COLORS.info, flex: 1, weight: 'bold' },
                {
                    type: 'box', layout: 'vertical', contents: [
                        { type: 'text', text: `${ev.emoji} ${ev.title}`, size: 'sm', weight: 'bold' },
                        ...(ev.location ? [{ type: 'text', text: `📍 ${ev.location}`, size: 'xxs', color: COLORS.muted }] : []),
                    ], flex: 3,
                },
            ],
            margin: idx === 0 ? undefined : 'lg',
        }));
    return {
        type: 'flex',
        altText: `📅 ${data.date} 行程：${data.events.length} 個事項`,
        contents: {
            type: 'bubble',
            styles: {
                header: { backgroundColor: COLORS.info },
            },
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: '📅 今日行程', color: COLORS.white, size: 'lg', weight: 'bold' },
                    { type: 'text', text: data.date, color: '#BBDEFB', size: 'xs', margin: 'sm' },
                ],
                paddingAll: '16px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: eventContents,
                paddingAll: '16px',
                spacing: 'sm',
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'button', style: 'primary', action: {
                            type: 'postback', label: '➕ 新增行程', data: 'action=add_event',
                        },
                    },
                    {
                        type: 'button', style: 'link', action: {
                            type: 'postback', label: '📋 本週行程', data: 'action=week_schedule',
                        },
                    },
                ],
                spacing: 'sm',
                paddingAll: '12px',
            },
        },
    };
}
// ================================
// Quick Reply Buttons
// ================================
function buildQuickReplyButtons() {
    return {
        items: [
            { type: 'action', action: { type: 'message', label: '📅 行程', text: '今天行程' } },
            { type: 'action', action: { type: 'message', label: '💰 財務', text: '這個月支出' } },
            { type: 'action', action: { type: 'message', label: '🏃 健康', text: '今日健康' } },
            { type: 'action', action: { type: 'message', label: '🚗 愛車', text: '車輛狀態' } },
            { type: 'action', action: { type: 'message', label: '❓ 幫助', text: '幫助' } },
        ],
    };
}
function detectDomain(text) {
    const lower = text.toLowerCase();
    if (/支出|花費|財務|錢|記帳|收入|帳單|預算/.test(lower))
        return 'finance';
    if (/健康|運動|體重|步數|心率|睡眠|卡路里/.test(lower))
        return 'health';
    if (/車|保養|加油|里程|油耗|jimny|驗車|保險/.test(lower))
        return 'vehicle';
    if (/行程|今天|明天|排程|會議|提醒|schedule/.test(lower))
        return 'schedule';
    return 'general';
}
//# sourceMappingURL=butler-flex.service.js.map