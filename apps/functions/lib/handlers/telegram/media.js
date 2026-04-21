"use strict";
/**
 * Telegram Media Handlers (V3 Audit #1)
 *
 * Extracted from telegram-webhook.handler.ts
 * Contains voice STT, location sharing, and photo/OCR receipt handlers.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVoiceMessage = handleVoiceMessage;
exports.handleLocationMessage = handleLocationMessage;
exports.handlePhotoMessage = handlePhotoMessage;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const api_1 = require("./api");
const finance_service_1 = require("../../services/finance.service");
const receipt_ocr_service_1 = require("../../services/butler/receipt-ocr.service");
const db = (0, firestore_1.getFirestore)();
// ================================
// Voice Message Handler (STT via Gemini)
// ================================
async function handleVoiceMessage(chatId, telegramUserId, message, handleNaturalLanguage) {
    const voice = message.voice;
    if (!voice)
        return;
    v2_1.logger.info(`[Telegram] Voice message received: duration=${voice.duration}s, file_id=${voice.file_id}`);
    await (0, api_1.sendChatAction)(chatId, 'typing');
    try {
        const token = await (0, api_1.getBotToken)();
        const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${voice.file_id}`);
        const fileData = await fileResponse.json();
        if (!fileData.ok || !fileData.result?.file_path) {
            await (0, api_1.sendMessage)(chatId, '❌ 無法處理語音訊息，請稍後再試。');
            return;
        }
        const voiceUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
        const voiceResponse = await fetch(voiceUrl);
        if (!voiceResponse.ok) {
            await (0, api_1.sendMessage)(chatId, '❌ 無法下載語音檔案。');
            return;
        }
        const audioBuffer = Buffer.from(await voiceResponse.arrayBuffer());
        const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            await (0, api_1.sendMessage)(chatId, '❌ AI 服務未設定，無法處理語音。');
            return;
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const audioPart = {
            inlineData: { data: audioBuffer.toString('base64'), mimeType: 'audio/ogg' },
        };
        const result = await model.generateContent([
            '請將這段語音訊息轉成文字。只輸出語音的文字內容，不要加任何說明或標點符號以外的內容。如果聽不清楚，回傳「無法辨識」。',
            audioPart,
        ]);
        const transcribed = result.response.text().trim();
        v2_1.logger.info(`[Telegram] STT result: "${transcribed}"`);
        if (!transcribed || transcribed === '無法辨識') {
            await (0, api_1.sendMessage)(chatId, '🎤 無法辨識語音內容，請重新錄製或使用文字輸入。');
            return;
        }
        await (0, api_1.sendMessage)(chatId, `🎤 語音辨識：「${transcribed}」\n\n⏳ 處理中...`);
        await handleNaturalLanguage(chatId, telegramUserId, transcribed);
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Voice STT error:', error);
        await (0, api_1.sendMessage)(chatId, '❌ 語音辨識失敗，請使用文字輸入。');
    }
}
// ================================
// Location Handler
// ================================
async function handleLocationMessage(chatId, telegramUserId, location) {
    v2_1.logger.info(`[Telegram] Location received: lat=${location.latitude}, lng=${location.longitude}`);
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號才能使用位置功能。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        await db.collection(`users/${linkedUid}/butler/locations`).add({
            latitude: location.latitude,
            longitude: location.longitude,
            source: 'telegram',
            timestamp: firestore_1.Timestamp.now(),
            type: 'shared',
        });
        await (0, api_1.sendMessage)(chatId, `📍 **位置已記錄**

緯度: ${location.latitude.toFixed(6)}
經度: ${location.longitude.toFixed(6)}

請選擇此位置的用途：`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⛽ 加油站', callback_data: `location_fuel_${location.latitude}_${location.longitude}` }],
                    [{ text: '🅿️ 停車位置', callback_data: `location_parking_${location.latitude}_${location.longitude}` }],
                    [{ text: '🔧 維修廠', callback_data: `location_service_${location.latitude}_${location.longitude}` }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Location save error:', error);
        await (0, api_1.sendMessage)(chatId, '❌ 無法儲存位置，請稍後再試。');
    }
}
// ================================
// Photo/OCR Handler (Receipt Scanner)
// ================================
async function handlePhotoMessage(chatId, telegramUserId, message) {
    const photos = message.photo;
    if (!photos || photos.length === 0)
        return;
    const photo = photos[photos.length - 1];
    const caption = message.caption || '';
    v2_1.logger.info(`[Telegram] Photo received: file_id=${photo.file_id}, caption="${caption}"`);
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號才能使用圖片功能。\n\n使用 /link 開始綁定。');
        return;
    }
    await (0, api_1.sendChatAction)(chatId, 'typing');
    await (0, api_1.sendMessage)(chatId, '🔍 正在辨識收據...');
    try {
        const token = await (0, api_1.getBotToken)();
        const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${photo.file_id}`);
        const fileData = await fileResponse.json();
        if (!fileData.ok || !fileData.result?.file_path) {
            await (0, api_1.sendMessage)(chatId, '❌ 無法處理圖片，請稍後再試。');
            return;
        }
        const photoUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
        const imgResponse = await fetch(photoUrl);
        if (!imgResponse.ok) {
            await (0, api_1.sendMessage)(chatId, '❌ 無法下載圖片。');
            return;
        }
        const imageBuffer = Buffer.from(await imgResponse.arrayBuffer());
        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const receipt = await (0, receipt_ocr_service_1.extractReceiptData)(imageBuffer, contentType);
        await finance_service_1.financeService.recordTransaction(linkedUid, {
            type: 'expense',
            amount: receipt.totalAmount,
            description: `${receipt.storeName}${receipt.items.length > 0 ? ' - ' + receipt.items.map(i => i.name).join(', ') : ''}`,
            category: receipt.category,
            date: receipt.date,
            source: 'manual',
            bankAccountId: '',
        });
        let msg = `📸 **收據辨識完成！**\n\n`;
        msg += `🏪 ${receipt.storeName}\n`;
        msg += `💰 $${receipt.totalAmount.toLocaleString()}\n`;
        msg += `📁 ${receipt.category}\n`;
        msg += `📅 ${receipt.date}\n`;
        if (receipt.items.length > 0) {
            msg += `\n📝 明細：\n`;
            receipt.items.slice(0, 5).forEach(item => {
                msg += `  • ${item.name} $${item.amount}${item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}\n`;
            });
            if (receipt.items.length > 5)
                msg += `  ... 共 ${receipt.items.length} 項\n`;
        }
        if (receipt.invoiceNumber)
            msg += `\n🧾 發票：${receipt.invoiceNumber}`;
        msg += `\n\n✅ 已自動記帳`;
        await (0, api_1.sendMessage)(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 查看本月支出', callback_data: 'cmd_balance' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
        v2_1.logger.info(`[Telegram] Receipt OCR success: ${receipt.storeName} $${receipt.totalAmount}`);
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Photo message error:', error);
        await (0, api_1.sendMessage)(chatId, '❌ 圖片處理發生錯誤，請稍後再試。');
    }
}
//# sourceMappingURL=media.js.map