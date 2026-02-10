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

export const TAIWAN_BANKS: Record<string, BankConfig> = {
    '808': {
        code: '808',
        name: '玉山銀行',
        englishName: 'E.SUN Bank',
        openBankingSupport: true,
        apiBase: 'https://openapi.esunbank.com.tw',
    },
    '822': {
        code: '822',
        name: '中國信託',
        englishName: 'CTBC Bank',
        openBankingSupport: true,
        apiBase: 'https://openapi.ctbcbank.com',
    },
    '004': {
        code: '004',
        name: '臺灣銀行',
        englishName: 'Bank of Taiwan',
        openBankingSupport: true,
        apiBase: 'https://fapi.bot.com.tw',
    },
    '007': {
        code: '007',
        name: '第一銀行',
        englishName: 'First Bank',
        openBankingSupport: true,
        apiBase: 'https://openapi.firstbank.com.tw',
    },
};

export const TRANSACTION_CATEGORIES = {
    income: ['薪資', '獎金', '投資收益', '退款', '其他收入'],
    expense: {
        essential: ['餐飲', '交通', '住宅', '水電瓦斯', '保險', '醫療'],
        lifestyle: ['娛樂', '購物', '旅遊', '訂閱服務', '教育'],
        business: ['營業支出', '設備採購', '人事費用', '稅務'],
        vehicle: ['加油', '保養', '停車', '過路費', '驗車'],
    },
} as const;

/**
 * Get bank config by code
 */
export function getBankConfig(bankCode: string): BankConfig | undefined {
    return TAIWAN_BANKS[bankCode];
}

/**
 * Get all supported bank codes
 */
export function getSupportedBankCodes(): string[] {
    return Object.keys(TAIWAN_BANKS);
}
