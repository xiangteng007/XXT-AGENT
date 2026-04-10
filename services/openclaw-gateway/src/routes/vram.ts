/**
 * VRAM Management Routes
 *
 * 讓使用者在需要使用其他程式（遊戲、剪輯、3D 等）時，
 * 一鍵釋放 Ollama 佔用的 GPU VRAM。
 *
 * 硬體環境: RTX 4080 SUPER 16GB VRAM
 *
 * Endpoints:
 *   GET  /vram/status              - 查詢目前 VRAM 使用狀況（已載入的模型）
 *   POST /vram/free                - 一鍵釋放所有 Ollama VRAM
 *   POST /vram/unload/:modelName   - 釋放指定模型的 VRAM
 */

import { Router, Request, Response } from 'express';
import {
    getRunningModels,
    freeAllVRAM,
    unloadModel,
    OllamaRunningModel,
} from '../ollama-inference.service';
import { logger } from '../logger';

export const vramRouter = Router();

// ── GET /vram/status ─────────────────────────────────────────
/**
 * 查詢目前 Ollama 已載入（佔用 VRAM）的模型清單
 *
 * Response:
 * {
 *   running_models: [...],
 *   total_vram_mb: 9437,   // 所有模型合計 VRAM MB
 *   model_count: 1
 * }
 */
vramRouter.get('/status', async (_req: Request, res: Response) => {
    try {
        const models = await getRunningModels();

        const totalVramBytes = models.reduce(
            (sum: number, m: OllamaRunningModel) => sum + (m.size_vram ?? m.size ?? 0),
            0,
        );

        res.json({
            ok: true,
            model_count: models.length,
            total_vram_mb: Math.round(totalVramBytes / 1024 / 1024),
            running_models: models.map((m: OllamaRunningModel) => ({
                name: m.name,
                vram_mb: Math.round((m.size_vram ?? m.size ?? 0) / 1024 / 1024),
                expires_at: m.expires_at,
            })),
            hardware: {
                gpu: 'RTX 4080 SUPER',
                total_vram_mb: 16376,
            },
        });
    } catch (err) {
        logger.error('[VRAM] Status check failed:', String(err));
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// ── POST /vram/free ───────────────────────────────────────────
/**
 * 一鍵釋放所有 Ollama 佔用的 VRAM
 * 適合在啟動遊戲、影片剪輯、3D 渲染前執行
 *
 * Response:
 * {
 *   ok: true,
 *   unloaded: ['qwen3:14b', 'qwen3-coder:30b-a3b'],
 *   failed: [],
 *   freed_vram_mb: 22000
 * }
 */
vramRouter.post('/free', async (_req: Request, res: Response) => {
    try {
        // 先記錄釋放前的狀態
        const before = await getRunningModels();
        const beforeVram = before.reduce(
            (sum: number, m: OllamaRunningModel) => sum + (m.size_vram ?? m.size ?? 0),
            0,
        );

        logger.info(`[VRAM] Free requested. Currently loaded: ${before.map((m: OllamaRunningModel) => m.name).join(', ') || 'none'}`);

        const result = await freeAllVRAM();

        res.json({
            ok: true,
            unloaded: result.unloaded,
            failed: result.failed,
            freed_vram_mb: Math.round(beforeVram / 1024 / 1024),
            message: result.unloaded.length === 0
                ? 'VRAM 已清空（無模型載入）'
                : `已釋放 ${result.unloaded.length} 個模型，預估釋放 ${Math.round(beforeVram / 1024 / 1024)} MB VRAM`,
        });
    } catch (err) {
        logger.error('[VRAM] Free all failed:', String(err));
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// ── POST /vram/unload/:modelName ──────────────────────────────
/**
 * 釋放指定模型的 VRAM（URL encoded model name）
 *
 * 範例: POST /vram/unload/qwen3%3A14b
 */
vramRouter.post('/unload/:modelName', async (req: Request, res: Response) => {
    const modelName = decodeURIComponent(req.params['modelName'] ?? '');
    if (!modelName) {
        res.status(400).json({ ok: false, error: 'modelName is required' });
        return;
    }

    try {
        logger.info(`[VRAM] Unload requested for: ${modelName}`);
        await unloadModel(modelName);
        res.json({
            ok: true,
            unloaded: modelName,
            message: `模型 ${modelName} 已卸載，VRAM 已釋放`,
        });
    } catch (err) {
        logger.error(`[VRAM] Unload ${modelName} failed:`, String(err));
        res.status(500).json({ ok: false, error: String(err) });
    }
});
