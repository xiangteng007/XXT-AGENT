/**
 * Taiwan Bank Configuration (V3 Audit #6)
 *
 * Extracted from finance.service.ts to enable centralized management
 * of bank API endpoints independently from service logic.
 */
export interface BankConfig {
    code: string;
    name: string;
    englishName: string;
    openBankingSupport: boolean;
    apiBase: string;
}
export declare const TAIWAN_BANKS: Record<string, BankConfig>;
export declare const TRANSACTION_CATEGORIES: {
    readonly income: readonly ["薪資", "獎金", "投資收益", "退款", "其他收入"];
    readonly expense: {
        readonly essential: readonly ["餐飲", "交通", "住宅", "水電瓦斯", "保險", "醫療"];
        readonly lifestyle: readonly ["娛樂", "購物", "旅遊", "訂閱服務", "教育"];
        readonly business: readonly ["營業支出", "設備採購", "人事費用", "稅務"];
        readonly vehicle: readonly ["加油", "保養", "停車", "過路費", "驗車"];
    };
};
/**
 * Get bank config by code
 */
export declare function getBankConfig(bankCode: string): BankConfig | undefined;
/**
 * Get all supported bank codes
 */
export declare function getSupportedBankCodes(): string[];
//# sourceMappingURL=bank-config.d.ts.map