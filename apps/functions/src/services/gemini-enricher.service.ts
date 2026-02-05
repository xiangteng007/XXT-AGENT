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

import { GoogleGenerativeAI } from '@google/generative-ai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { z } from 'zod';
import { GeminiEnrichRequest, GeminiEnrichResponse, Entity } from '../types/social.types';

const secretManager = new SecretManagerServiceClient();

let geminiClient: GoogleGenerativeAI | null = null;

// Zod Schema for Gemini response validation (per SPEC_PHASE6_5_PHASE7_CLOUD.md)
const GeminiResponseSchema = z.object({
    severity: z.number().min(0).max(100),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    keywords: z.array(z.string()).max(10),
    entities: z.array(z.object({
        type: z.enum(['ticker', 'fund', 'future', 'topic', 'location', 'person', 'org']),
        value: z.string(),
    })).max(10),
    impactHint: z.string(),
    rationale: z.string(),
});

/**
 * Initialize Gemini client with API key from Secret Manager
 */
async function getGeminiClient(): Promise<GoogleGenerativeAI> {
    if (geminiClient) return geminiClient;

    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const secretName = `projects/${projectId}/secrets/GEMINI_API_KEY/versions/latest`;

    try {
        const [version] = await secretManager.accessSecretVersion({ name: secretName });
        const apiKey = version.payload?.data?.toString() || '';
        geminiClient = new GoogleGenerativeAI(apiKey);
        return geminiClient;
    } catch (err) {
        console.error('[Gemini] Failed to get API key from Secret Manager:', err);
        throw new Error('Gemini API key not available');
    }
}

/**
 * Enrich content with Gemini AI
 */
export async function enrichWithGemini(request: GeminiEnrichRequest): Promise<GeminiEnrichResponse> {
    const client = await getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = buildSystemPrompt(request.type);
    const userPrompt = buildUserPrompt(request);

    try {
        const result = await model.generateContent([
            { text: systemPrompt },
            { text: userPrompt },
        ]);

        const response = result.response.text();

        // Parse JSON response
        const parsed = parseGeminiResponse(response);
        return validated(parsed);

    } catch (err: unknown) {
        console.error('[Gemini] Enrichment failed:', err);

        // Return default response on failure
        return {
            severity: 30,
            sentiment: 'neutral',
            keywords: request.context?.existingKeywords || [],
            entities: [],
            impactHint: '',
            rationale: 'AI enrichment failed',
        };
    }
}

/**
 * Build system prompt based on content type
 */
function buildSystemPrompt(type: 'social' | 'news' | 'fusion'): string {
    const basePrompt = `你是一個專業的情報分析師 AI。請分析以下內容並以 JSON 格式輸出結果。

輸出必須符合以下 JSON schema：
{
  "severity": <0-100 整數，表示事件嚴重程度>,
  "sentiment": "<positive|negative|neutral>",
  "keywords": [<最多5個關鍵字>],
  "entities": [{"type": "<ticker|topic|location|person|org>", "value": "<實體名稱>"}],
  "impactHint": "<一句話描述可能的影響>",
  "rationale": "<簡短說明判斷依據>"
}

嚴重度評分標準：
- 0-30：一般資訊，無緊急性
- 31-50：值得關注的事件
- 51-70：重要事件，需要追蹤
- 71-85：緊急事件，需要立即關注
- 86-100：危機等級，需要即刻行動

請只輸出 JSON，不要有其他文字。`;

    if (type === 'social') {
        return basePrompt + '\n\n專注於社群媒體內容的病毒式傳播潛力和輿情影響。';
    } else if (type === 'news') {
        return basePrompt + '\n\n專注於新聞事件對市場和投資的影響。';
    } else {
        return basePrompt + '\n\n綜合分析多來源情報，評估整體影響。';
    }
}

/**
 * Build user prompt with content and context
 */
function buildUserPrompt(request: GeminiEnrichRequest): string {
    let prompt = `請分析以下${request.type === 'social' ? '社群' : request.type === 'news' ? '新聞' : '綜合'}內容：\n\n${request.content}`;

    if (request.context) {
        if (request.context.platform) {
            prompt += `\n\n平台：${request.context.platform}`;
        }
        if (request.context.location) {
            prompt += `\n地點：${request.context.location}`;
        }
    }

    return prompt;
}

/**
 * Parse Gemini response JSON
 */
function parseGeminiResponse(response: string): Partial<GeminiEnrichResponse> {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No JSON found in response');
    }

    try {
        return JSON.parse(jsonMatch[0]);
    } catch (_err) {
        throw new Error('Failed to parse JSON response');
    }
}

/**
 * Validate and normalize response using Zod (per spec: must reject non-JSON and fallback)
 */
function validated(partial: Partial<GeminiEnrichResponse>): GeminiEnrichResponse {
    try {
        // Attempt strict Zod validation
        const result = GeminiResponseSchema.safeParse(partial);
        if (result.success) {
            // Cast to match our Entity type which has optional confidence
            return {
                severity: result.data.severity,
                sentiment: result.data.sentiment,
                keywords: result.data.keywords,
                entities: result.data.entities.map(e => ({ ...e, confidence: undefined })),
                impactHint: result.data.impactHint,
                rationale: result.data.rationale,
            };
        }

        // Log Zod validation errors for debugging
        console.warn('[Gemini] Zod validation failed:', JSON.stringify(result.error.issues));

        // Fallback: apply manual normalization
        return fallbackValidation(partial);
    } catch (err) {
        console.warn('[Gemini] Validation error, using fallback:', err);
        return fallbackValidation(partial);
    }
}

/**
 * Fallback validation when Zod fails (rule engine)
 */
function fallbackValidation(partial: Partial<GeminiEnrichResponse>): GeminiEnrichResponse {
    return {
        severity: clamp(partial.severity ?? 30, 0, 100),
        sentiment: validateSentiment(partial.sentiment),
        keywords: Array.isArray(partial.keywords) ? partial.keywords.slice(0, 10) : [],
        entities: validateEntities(partial.entities),
        impactHint: partial.impactHint || '',
        rationale: partial.rationale || 'Fallback: AI response did not match expected schema',
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
}

function validateSentiment(s: unknown): 'positive' | 'negative' | 'neutral' {
    if (s === 'positive' || s === 'negative' || s === 'neutral') {
        return s;
    }
    return 'neutral';
}

function validateEntities(entities: unknown): Entity[] {
    if (!Array.isArray(entities)) return [];

    return entities
        .filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object' && 'type' in e && 'value' in e)
        .map(e => ({
            type: ['ticker', 'fund', 'future', 'topic', 'location', 'person', 'org'].includes(String(e.type))
                ? (e.type as Entity['type']) : 'topic',
            value: String(e.value),
            confidence: typeof e.confidence === 'number' ? e.confidence : undefined,
        }))
        .slice(0, 10);
}
