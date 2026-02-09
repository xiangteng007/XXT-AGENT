/**
 * Monthly Insights Service
 * 
 * Generates AI-powered cross-domain monthly insights by analyzing
 * finance + health + schedule data to find patterns and provide advice.
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface MonthlyInsight {
    month: string; // YYYY-MM
    generatedAt: Date;
    sections: InsightSection[];
    summary: string;
}

interface InsightSection {
    title: string;
    icon: string;
    items: string[];
    severity: 'info' | 'warning' | 'success';
}

/**
 * Generate monthly cross-domain insights for a user
 */
export async function generateMonthlyInsights(uid: string, month?: string): Promise<MonthlyInsight> {
    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, mon] = targetMonth.split('-').map(Number);
    const startDate = `${targetMonth}-01`;
    const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    console.log(`[Monthly Insights] Generating for ${uid}, month: ${targetMonth}`);

    // Fetch finance data
    const txSnap = await db.collection(`users/${uid}/transactions`)
        .where('date', '>=', startDate)
        .where('date', '<', endDate)
        .get();
    
    const transactions = txSnap.docs.map(d => d.data());
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        const cat = t.category || '其他';
        categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
    });
    const topCategories = Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    // Fetch health data
    const healthSnap = await db.collection(`users/${uid}/health_records`)
        .where('date', '>=', startDate)
        .where('date', '<', endDate)
        .orderBy('date', 'desc')
        .limit(31)
        .get();

    const healthRecords = healthSnap.docs.map(d => d.data());
    const avgSteps = healthRecords.length > 0
        ? Math.round(healthRecords.reduce((s, r) => s + (r.steps || 0), 0) / healthRecords.length)
        : 0;
    const avgSleep = healthRecords.length > 0
        ? (healthRecords.reduce((s, r) => s + (r.sleepHours || 0), 0) / healthRecords.length).toFixed(1)
        : '0';

    // Build insight sections
    const sections: InsightSection[] = [];

    // Finance section
    const financeItems: string[] = [];
    financeItems.push(`本月支出: $${totalExpense.toLocaleString()}`);
    financeItems.push(`本月收入: $${totalIncome.toLocaleString()}`);
    const savingRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : '0';
    financeItems.push(`儲蓄率: ${savingRate}%`);
    if (topCategories.length > 0) {
        financeItems.push(`最大支出: ${topCategories[0][0]} ($${topCategories[0][1].toLocaleString()})`);
    }
    sections.push({
        title: '💰 財務總覽',
        icon: '💰',
        items: financeItems,
        severity: parseFloat(savingRate) >= 20 ? 'success' : parseFloat(savingRate) >= 0 ? 'info' : 'warning',
    });

    // Health section
    if (healthRecords.length > 0) {
        const healthItems: string[] = [];
        healthItems.push(`平均每日步數: ${avgSteps.toLocaleString()}`);
        healthItems.push(`平均睡眠: ${avgSleep} 小時`);
        if (avgSteps < 5000) healthItems.push('⚠️ 建議增加每日活動量，目標 8,000 步');
        if (parseFloat(avgSleep) < 7) healthItems.push('⚠️ 睡眠不足，建議每晚至少 7 小時');
        if (avgSteps >= 8000) healthItems.push('✅ 步數達標！繼續保持');
        sections.push({
            title: '🏃 健康分析',
            icon: '🏃',
            items: healthItems,
            severity: avgSteps >= 8000 && parseFloat(avgSleep) >= 7 ? 'success' : 'info',
        });
    }

    // Cross-domain insights
    const crossItems: string[] = [];
    if (categoryMap['飲食'] && healthRecords.length > 0) {
        const foodSpend = categoryMap['飲食'];
        const dailyFood = foodSpend / 30;
        crossItems.push(`每日飲食花費約 $${Math.round(dailyFood)}，步數平均 ${avgSteps}`);
        if (dailyFood > 500 && avgSteps < 5000) {
            crossItems.push('💡 飲食支出較高但活動量低，建議自煮節省同時增加運動');
        }
    }
    if (categoryMap['交通'] && categoryMap['交通'] > totalExpense * 0.15) {
        crossItems.push('💡 交通佔比超過 15%，可考慮搭乘大眾運輸或共乘');
    }
    if (crossItems.length > 0) {
        sections.push({
            title: '🔗 跨域洞察',
            icon: '🔗',
            items: crossItems,
            severity: 'info',
        });
    }

    // Summary
    const summary = `${targetMonth} 月報：支出 $${totalExpense.toLocaleString()}、收入 $${totalIncome.toLocaleString()}、儲蓄率 ${savingRate}%${avgSteps > 0 ? `、平均步數 ${avgSteps}` : ''}`;

    const insight: MonthlyInsight = {
        month: targetMonth,
        generatedAt: new Date(),
        sections,
        summary,
    };

    // Store the insight
    await db.collection(`users/${uid}/monthly_insights`).doc(targetMonth).set(insight);
    console.log(`[Monthly Insights] Generated: ${summary}`);

    return insight;
}
