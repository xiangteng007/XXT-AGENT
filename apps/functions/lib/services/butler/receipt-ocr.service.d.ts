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
interface ReceiptData {
    storeName: string;
    totalAmount: number;
    date: string;
    items: Array<{
        name: string;
        amount: number;
        quantity?: number;
    }>;
    paymentMethod?: string;
    invoiceNumber?: string;
    category: string;
    confidence: number;
}
export declare function extractReceiptData(imageBuffer: Buffer, mimeType?: string): Promise<ReceiptData>;
export declare function processReceiptImage(userId: string, imageUrl: string, channelAccessToken: string): Promise<string>;
export declare const receiptOcrService: {
    extractReceiptData: typeof extractReceiptData;
    processReceiptImage: typeof processReceiptImage;
};
export {};
//# sourceMappingURL=receipt-ocr.service.d.ts.map