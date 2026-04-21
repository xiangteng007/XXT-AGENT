/**
 * Argus Dynamic Memory & Trust Weight System (Phase 5)
 * Maintains long-term trust scores for various OSINT sources.
 * To be replaced with a Prisma Model (`IntelligenceSource`) in production.
 */

export interface SourceProfile {
  domainOrUser: string;
  baseTrust: number;
  truePositives: number;
  falseAlarms: number;
}

class IntelligenceMemoryStore {
  // In-memory mock database for OSINT sources
  private sources: Map<string, SourceProfile> = new Map([
    ['bloomberg.com', { domainOrUser: 'bloomberg.com', baseTrust: 95, truePositives: 50, falseAlarms: 1 }],
    ['Threads/engineer_x', { domainOrUser: 'Threads/engineer_x', baseTrust: 60, truePositives: 2, falseAlarms: 0 }],
    ['Mobile01/unverified', { domainOrUser: 'Mobile01/unverified', baseTrust: 40, truePositives: 0, falseAlarms: 5 }]
  ]);

  /**
   * Retrieves the current dynamically adjusted credibility score for a source.
   */
  public getCredibilityScore(sourceId: string): number {
    const profile = this.sources.get(sourceId);
    if (!profile) return 50; // Neutral default for unknown sources

    // Dynamic weight formula: Penalty for false alarms, slight bump for true positives
    const adjustedScore = profile.baseTrust + (profile.truePositives * 1.5) - (profile.falseAlarms * 10);
    
    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, Math.floor(adjustedScore)));
  }

  /**
   * Feedback loop triggered to adjust source weighting.
   */
  public updateSourceFeedback(sourceId: string, isAccurate: boolean) {
    if (!this.sources.has(sourceId)) {
      this.sources.set(sourceId, { domainOrUser: sourceId, baseTrust: 50, truePositives: 0, falseAlarms: 0 });
    }
    
    const profile = this.sources.get(sourceId)!;
    if (isAccurate) {
      profile.truePositives += 1;
      console.log(`[Argus Memory] Source [${sourceId}] verified TRUE. Credibility increased.`);
    } else {
      profile.falseAlarms += 1;
      console.log(`[Argus Memory] Source [${sourceId}] scored False Alarm! Credibility heavily penalized.`);
    }
  }
}

export const argusMemory = new IntelligenceMemoryStore();
