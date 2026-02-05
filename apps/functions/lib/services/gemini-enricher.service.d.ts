/**
 * Gemini Enricher Service
 *
 * Uses Gemini AI to enrich social posts with:
 * - Severity scoring
 * - Sentiment analysis
 * - Keyword extraction
 * - Entity recognition
 * - Impact hints
 */
import { GeminiEnrichRequest, GeminiEnrichResponse } from '../types/social.types';
/**
 * Enrich content with Gemini AI
 */
export declare function enrichWithGemini(request: GeminiEnrichRequest): Promise<GeminiEnrichResponse>;
//# sourceMappingURL=gemini-enricher.service.d.ts.map