import { openClawGateway } from '../../gateway/openclaw';
import { argusMemory } from './memory';

export interface ArgusIntelligenceReport {
  eventId: string;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'MATERIALS' | 'STRUCTURAL' | 'CLIMATE' | 'CYBER' | 'REPUTATION' | 'POLICY';
  summary: string;
  impactedAgents: string[];
  rawSourceUrl?: string;
  // 新增：情報可信度與交叉比對機制
  credibilityScore: number; // 0-100分，根據消息來源與語氣判定
  corroborationCount: number; // 該情報是否在多個獨立來源被證實（例如 FB + 新聞皆有報導）
}

/**
 * Argus Analyzer / Synthesizer
 * Connects to LLM (e.g., Gemini 1.5 Pro / Claude 3.5 Sonnet) 
 * to reduce noise from Crawlers and output structured intelligence JSON.
 */
export async function synthesizeIntelligence(rawData: any[]): Promise<ArgusIntelligenceReport[]> {
  console.log('[Argus] Synthesizer analyzing incoming raw data for credibility and threat level...');
  
  // Minimal representation for Phase 1 MVP
  const intelReports: ArgusIntelligenceReport[] = rawData.map((data, idx) => {
    // LLM Call Simulation
    const isMaterial = data.content?.includes('鋼筋') || data.title?.includes('Copper');
    
    // 模擬 LLM 的情報評判邏輯：加上 Phase 5 動態記憶體抓取功能
    const rawSourceId = data.sourceId || (data.rawSourceUrl?.includes('bloomberg') ? 'bloomberg.com' : 'Threads/engineer_x');
    const isOfficialSource = rawSourceId.includes('bloomberg') || rawSourceId.includes('gov');
    const baseCredibility = argusMemory.getCredibilityScore(rawSourceId);

    return {
      eventId: `ARGUS-INT-${Date.now()}-${idx}`,
      threatLevel: isMaterial ? 'HIGH' : 'MEDIUM',
      category: isMaterial ? 'MATERIALS' : 'POLICY',
      summary: `[合成戰情] ${data.title || data.content}`,
      impactedAgents: isMaterial ? ['Rusty'] : ['Titan'],
      rawSourceUrl: data.source || 'social/threads',
      credibilityScore: baseCredibility,
      corroborationCount: isOfficialSource ? 3 : 1
    };
  });

  // Broadcast to Gateway
  for (const report of intelReports) {
    if (report.threatLevel === 'HIGH' || report.threatLevel === 'CRITICAL') {
      await openClawGateway.emit('INTELLIGENCE_DISCOVERED', report);
    }
  }

  return intelReports;
}
