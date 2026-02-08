/**
 * Receipt OCR Service
 * 
 * Uses Gemini Vision (gemini-1.5-flash) to extract structured data
 * from receipt/invoice images sent via LINE.
 * 
 * Flow:
 *   1. User sends image → LINE webhook receives image URL
 *   2. Download image from LINE Content API
 *   3. Send to Gemini Vision for structured extraction
 *   4. Auto-categorize → record transaction in Firestore
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { financeService } from '../finance.service';

// ================================
// Types
// ================================

interface ReceiptData {
    storeName: string;
    totalAmount: number;
    date: string;
    items: Array<{ name: string; amount: number; quantity?: number }>;
    paymentMethod?: string;
    invoiceNumber?: string;
    category: string;
    confidence: number;
}

// ================================
// Gemini Vision Client
// ================================

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (!genAI) {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) throw new Error('Missing GOOGLE_AI_API_KEY');
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

// ================================
// OCR Extraction
// ================================

const RECEIPT_PROMPT = `你是一個收據/發票 OCR 專家。分析這張圖片並提取以下結構化資訊。

請以 JSON 格式回傳：
{
    "storeName": "商店名稱",
    "totalAmount": 數字（總金額），
    "date": "YYYY-MM-DD格式",
    "items": [
        { "name": "品項名稱", "amount": 數字, "quantity": 數量 }
    ],
    "paymentMethod": "現金/信用卡/行動支付",
    "invoiceNumber": "發票號碼（如果有）",
    "category": "餐飲/購物/交通/醫療/娛樂/日用品/其他",
    "confidence": 0到1之間的信心分數
}

規則：
- 金額使用數字，不要包含貨幣符號
- 日期如果看不清楚，使用今天的日期
- category 必須是以上列出的其中一個
- 如果無法辨識圖片內容，回傳 confidence: 0

只回傳 JSON，不要其他文字。`;

export async function extractReceiptData(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
): Promise<ReceiptData> {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imagePart = {
        inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType,
        },
    };

    const result = await model.generateContent([RECEIPT_PROMPT, imagePart]);
    const responseText = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Failed to parse receipt data from AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as ReceiptData;

    // Validation
    if (!parsed.totalAmount || parsed.totalAmount <= 0) {
        throw new Error('Invalid total amount extracted');
    }
    if (!parsed.date) {
        parsed.date = new Date().toISOString().split('T')[0];
    }
    if (parsed.confidence < 0.3) {
        throw new Error('Low confidence in receipt extraction');
    }

    return parsed;
}

// ================================
// Process Receipt Image from LINE
// ================================

export async function processReceiptImage(
    userId: string,
    imageUrl: string,
    channelAccessToken: string
): Promise<string> {
    try {
        // Download image from LINE Content API
        const imageResponse = await fetch(imageUrl, {
            headers: { Authorization: `Bearer ${channelAccessToken}` },
        });

        if (!imageResponse.ok) {
            return '⚠️ 無法下載圖片，請重新傳送';
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        // Extract receipt data via Gemini Vision
        const receipt = await extractReceiptData(imageBuffer, contentType);

        // Record transaction
        await financeService.recordTransaction(userId, {
            type: 'expense',
            amount: receipt.totalAmount,
            description: `${receipt.storeName}${receipt.items.length > 0 ? ' - ' + receipt.items.map(i => i.name).join(', ') : ''}`,
            category: receipt.category,
            date: receipt.date,
            source: 'manual',
            bankAccountId: '',
        });

        // Format response
        let msg = `📸 收據辨識完成！\n\n`;
        msg += `🏪 ${receipt.storeName}\n`;
        msg += `💰 $${receipt.totalAmount.toLocaleString()}\n`;
        msg += `📁 ${receipt.category}\n`;
        msg += `📅 ${receipt.date}\n`;

        if (receipt.items.length > 0) {
            msg += `\n📝 明細：\n`;
            receipt.items.slice(0, 5).forEach(item => {
                msg += `  • ${item.name} $${item.amount}${item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}\n`;
            });
            if (receipt.items.length > 5) {
                msg += `  ... 共 ${receipt.items.length} 項\n`;
            }
        }

        if (receipt.invoiceNumber) {
            msg += `\n🧾 發票：${receipt.invoiceNumber}`;
        }

        msg += `\n\n✅ 已自動記帳。回覆「取消」可撤銷`;
        return msg;

    } catch (error) {
        console.error('[ReceiptOCR] Processing failed:', error);
        if ((error as Error).message.includes('Low confidence')) {
            return '📸 無法清楚辨識這張收據，請確保圖片清晰且包含金額資訊。\n\n💡 您也可以手動記帳，例如：「記帳 500 午餐」';
        }
        return '⚠️ 收據辨識失敗，請稍後再試。\n\n💡 手動記帳：「記帳 500 午餐」';
    }
}

export const receiptOcrService = {
    extractReceiptData,
    processReceiptImage,
};
