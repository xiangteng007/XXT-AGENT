"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getButlerRichMenuConfig = getButlerRichMenuConfig;
exports.setupRichMenu = setupRichMenu;
exports.generateRichMenuImageSVG = generateRichMenuImageSVG;
const v2_1 = require("firebase-functions/v2");
/**
 * Butler LINE Rich Menu Configuration
 *
 * Defines the Rich Menu layout and actions for the 小秘書 Butler bot.
 * Call `setupRichMenu()` to create and set the Rich Menu via LINE API.
 *
 * Layout: 2 rows × 3 columns
 * ┌──────────┬──────────┬──────────┐
 * │ 📅 行程  │ 💰 財務  │ 🏃 健康  │
 * ├──────────┼──────────┼──────────┤
 * │ 🚗 愛車  │ 🤖 AI    │ ❓ 幫助  │
 * └──────────┴──────────┴──────────┘
 */
const LINE_API_BASE = 'https://api.line.me/v2/bot';
// ================================
// Rich Menu Definition
// ================================
const CELL_WIDTH = 833; // 2500 / 3
const ROW_HEIGHT = 422; // 843 / 2
function getButlerRichMenuConfig() {
    return {
        size: { width: 2500, height: 843 },
        selected: true,
        name: 'XXT Butler Main Menu v2',
        chatBarText: '📋 小秘書選單',
        areas: [
            // Row 1
            {
                bounds: { x: 0, y: 0, width: CELL_WIDTH, height: ROW_HEIGHT },
                action: { type: 'message', text: '今天行程', label: '📅 行程' },
            },
            {
                bounds: { x: CELL_WIDTH, y: 0, width: CELL_WIDTH, height: ROW_HEIGHT },
                action: { type: 'message', text: '這個月支出', label: '💰 財務' },
            },
            {
                bounds: { x: CELL_WIDTH * 2, y: 0, width: CELL_WIDTH + 1, height: ROW_HEIGHT },
                action: { type: 'message', text: '今日健康', label: '🏃 健康' },
            },
            // Row 2
            {
                bounds: { x: 0, y: ROW_HEIGHT, width: CELL_WIDTH, height: ROW_HEIGHT + 1 },
                action: { type: 'message', text: '車輛狀態', label: '🚗 愛車' },
            },
            {
                bounds: { x: CELL_WIDTH, y: ROW_HEIGHT, width: CELL_WIDTH, height: ROW_HEIGHT + 1 },
                action: { type: 'postback', data: 'action=ai_chat', label: '🤖 AI 助理' },
            },
            {
                bounds: { x: CELL_WIDTH * 2, y: ROW_HEIGHT, width: CELL_WIDTH + 1, height: ROW_HEIGHT + 1 },
                action: { type: 'message', text: '幫助', label: '❓ 幫助' },
            },
        ],
    };
}
// ================================
// Rich Menu Setup (via LINE API)
// ================================
async function setupRichMenu(accessToken) {
    const config = getButlerRichMenuConfig();
    // 1. Create Rich Menu
    const createRes = await fetch(`${LINE_API_BASE}/richmenu`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(config),
    });
    if (!createRes.ok) {
        throw new Error(`Failed to create Rich Menu: ${await createRes.text()}`);
    }
    const { richMenuId } = await createRes.json();
    v2_1.logger.info(`[RichMenu] Created: ${richMenuId}`);
    // 2. Set as default
    const setDefaultRes = await fetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!setDefaultRes.ok) {
        v2_1.logger.warn(`[RichMenu] Failed to set default: ${await setDefaultRes.text()}`);
    }
    else {
        v2_1.logger.info(`[RichMenu] Set as default for all users`);
    }
    return richMenuId;
}
// ================================
// Rich Menu Image Generator
// (Generates a simple text-based image via Canvas-like approach)
// ================================
function generateRichMenuImageSVG() {
    const cells = [
        { emoji: '📅', label: '行程', color: '#2196F3' },
        { emoji: '💰', label: '財務', color: '#4CAF50' },
        { emoji: '🏃', label: '健康', color: '#009688' },
        { emoji: '🚗', label: '愛車', color: '#607D8B' },
        { emoji: '🤖', label: 'AI 助理', color: '#9C27B0' },
        { emoji: '❓', label: '幫助', color: '#FF9800' },
    ];
    const svgCells = cells.map((cell, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = col * CELL_WIDTH;
        const y = row * ROW_HEIGHT;
        return `
            <rect x="${x}" y="${y}" width="${CELL_WIDTH}" height="${ROW_HEIGHT}" fill="${cell.color}" rx="0"/>
            <text x="${x + CELL_WIDTH / 2}" y="${y + ROW_HEIGHT / 2 - 20}" text-anchor="middle" font-size="80">${cell.emoji}</text>
            <text x="${x + CELL_WIDTH / 2}" y="${y + ROW_HEIGHT / 2 + 50}" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">${cell.label}</text>
        `;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="843" viewBox="0 0 2500 843">
        <rect width="2500" height="843" fill="#1A1A1A"/>
        ${svgCells}
    </svg>`;
}
//# sourceMappingURL=rich-menu.config.js.map