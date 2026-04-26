/**
 * MPE Telegram Commands
 *
 * /predict [代號]  — 查詢 MPE 預測（即時生成）
 * /signal          — 今日有效訊號列表
 * /mpe             — MPE 系統狀態
 * /backtest [代號] — 歷史訊號準確率（ChromaDB RAG）
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Context = any;
import { logger } from 'firebase-functions/v2';
import { getActiveSignals, formatSignalForTelegram, generateSignal } from '../../services/mpe/signal-generator.service';
import { fetchMacroSnapshot, classifyMacroRegime } from '../../services/mpe/macro-data.service';
import { runOsintScan } from '../../services/mpe/osint-scanner.service';
import { fetchOHLCV, extractClosePrices, calcAnnualizedVolatility, calcAnnualizedDrift } from '../../services/mpe/market-data.service';
import { runMonteCarlo } from '../../services/mpe/monte-carlo.service';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

// ─────────────────────────────────────────
// /signal — Active signals list
// ─────────────────────────────────────────

export async function handleSignalCommand(ctx: Context): Promise<void> {
  await ctx.reply('🔍 查詢中...');

  try {
    const signals = await getActiveSignals();

    if (signals.length === 0) {
      await ctx.reply('📭 目前沒有符合門檻的有效訊號（R/R ≥ 2.5 且信心 ≥ 55%）');
      return;
    }

    for (const signal of signals.slice(0, 3)) {
      await ctx.reply(formatSignalForTelegram(signal), { parse_mode: 'Markdown' });
    }

    if (signals.length > 3) {
      await ctx.reply(`還有 ${signals.length - 3} 個訊號，使用 /predict [代號] 查看特定標的`);
    }
  } catch (err) {
    logger.error('[MPE Telegram] /signal error:', err);
    await ctx.reply('❌ 訊號查詢失敗，請稍後再試');
  }
}

// ─────────────────────────────────────────
// /mpe — System status dashboard
// ─────────────────────────────────────────

export async function handleMpeCommand(ctx: Context): Promise<void> {
  await ctx.reply('📊 查詢 MPE 系統狀態...');

  try {
    const [macro, sentiment, signalCount] = await Promise.all([
      fetchMacroSnapshot(),
      runOsintScan(),
      getActiveSignals().then(s => s.length),
    ]);

    const regime = classifyMacroRegime(macro);

    const riskEmoji = {
      RISK_ON:  '🟢',
      RISK_OFF: '🔴',
      NEUTRAL:  '⚪',
    }[regime.riskMode];

    const volEmoji = {
      LOW:     '💤',
      MEDIUM:  '⚡',
      HIGH:    '🌩',
      EXTREME: '☢️',
    }[regime.volatilityLevel];

    const sentEmoji = sentiment.overallScore >= 40  ? '🐂' :
                      sentiment.overallScore >= 10  ? '🟡' :
                      sentiment.overallScore >= -10 ? '⚪' :
                      sentiment.overallScore >= -40 ? '🟠' : '🐻';

    const msg = [
      '🤖 **MPE 系統狀態**',
      '',
      '**總經環境**',
      `${riskEmoji} 風險模式：${regime.riskMode}`,
      `${volEmoji} 波動等級：${regime.volatilityLevel}`,
      `DXY：${macro.dxy.toFixed(2)} | VIX：${macro.vix.toFixed(1)} | 美10Y：${macro.us10y.toFixed(2)}%`,
      '',
      '**市場情緒**',
      `${sentEmoji} 情緒分數：${sentiment.overallScore > 0 ? '+' : ''}${sentiment.overallScore}`,
      `掃描新聞：${sentiment.newsCount} 則`,
      sentiment.keyEvents.length > 0 ? `⚠️ 重大事件：${sentiment.keyEvents[0]}` : '',
      '',
      `📡 有效訊號：${signalCount} 個`,
      `🕐 更新時間：${new Date().toLocaleTimeString('zh-TW')}`,
      '',
      `${regime.description}`,
    ].filter(Boolean).join('\n');

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('[MPE Telegram] /mpe error:', err);
    await ctx.reply('❌ 狀態查詢失敗');
  }
}

// ─────────────────────────────────────────
// /predict [代號] — On-demand prediction
// ─────────────────────────────────────────

export async function handlePredictCommand(ctx: Context): Promise<void> {
  const text = (ctx.message as { text?: string })?.text ?? '';
  const parts = text.trim().split(/\s+/);

  // Support: /predict TSLA  or  /predict force TSLA
  const forceRegen = parts[1]?.toLowerCase() === 'force';
  const rawSymbol  = forceRegen ? parts[2] : parts[1];
  const symbol     = rawSymbol?.toUpperCase();

  if (!symbol) {
    await ctx.reply(
      '使用方式：`/predict 2330`（台積電）或 `/predict TSLA`\n強制重生成：`/predict force 2330`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await ctx.reply(`🔍 正在分析 ${symbol}，約需 30-60 秒...`);

  try {
    // Check cache first (unless forced)
    if (!forceRegen) {
      const existing = await getActiveSignals(symbol);
      if (existing.length > 0) {
        await ctx.reply(formatSignalForTelegram(existing[0]), { parse_mode: 'Markdown' });
        await ctx.reply(
          `ℹ️ 以上為快取訊號（有效期內），使用 \`/predict force ${symbol}\` 強制重新生成`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    // Fetch OHLCV from Yahoo Finance
    await ctx.reply(`📡 正在從 Yahoo Finance 取得 ${symbol} K線資料...`);
    let ohlcv;
    try {
      ohlcv = await fetchOHLCV(symbol);
    } catch (fetchErr) {
      logger.warn(`[MPE Telegram] OHLCV fetch failed for ${symbol}:`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
      await ctx.reply(
        `⚠️ 無法取得 ${symbol} 的 K線資料\n\n` +
        `請確認代號是否正確：\n• 台股：4-6位數字（如 2330、0050）\n• 美股：英文代號（如 TSLA、AAPL）\n\n` +
        `使用 /signal 查看已有分析的標的列表。`
      );
      return;
    }

    const closePrices     = extractClosePrices(ohlcv);
    const annualizedVol   = calcAnnualizedVolatility(closePrices);
    const annualizedDrift = calcAnnualizedDrift(closePrices);
    const curr            = ohlcv.currency === 'TWD' ? 'NT$' : '$';

    // Quick Monte Carlo preview (5k sims for speed)
    const mc = runMonteCarlo({
      symbol,
      currentPrice: ohlcv.latestClose,
      annualizedVolatility: annualizedVol,
      annualizedDrift,
      horizonDays: 5,
      simulations: 5000,
    });

    const mcMsg = [
      `📊 **${symbol} 蒙特卡洛快速預覽** (N=5,000)`,
      `💰 現價：${curr}${ohlcv.latestClose.toFixed(2)}`,
      `📈 5日上漲機率：**${mc.upProbability}%**`,
      `🎯 預期目標：${curr}${mc.expectedPrice.toFixed(2)}`,
      `📉 80% 落點：${curr}${mc.p10.toFixed(2)} ～ ${curr}${mc.p90.toFixed(2)}`,
      `⚠️ VaR(95%)：-${curr}${mc.var95.toFixed(2)}`,
      `📊 波動率：${annualizedVol.toFixed(1)}% | 年化漂移：${annualizedDrift > 0 ? '+' : ''}${annualizedDrift.toFixed(1)}%`,
      '',
      '🤖 正在生成完整 MPE 訊號（需 30-60 秒）...',
    ].join('\n');

    await ctx.reply(mcMsg, { parse_mode: 'Markdown' });

    // Full MPE signal via generateSignal(SignalRequest)
    try {
      const signal = await generateSignal({
        symbol,
        currentPrice: ohlcv.latestClose,
        candles: ohlcv.bars,  // OHLCVBar is compatible with OHLCV type
      });

      if (signal) {
        await ctx.reply(formatSignalForTelegram(signal), { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(
          `⚠️ ${symbol} 訊號未達門檻（R/R < 2.5 或信心 < 55%）\n\n` +
          `以上蒙特卡洛預覽仍可供參考。`
        );
      }
    } catch (sigErr) {
      logger.error(`[MPE Telegram] Signal generation failed for ${symbol}:`, sigErr);
      await ctx.reply(
        `⚠️ 完整訊號生成失敗（Ollama 可能離線）\n\n以上蒙特卡洛預覽仍可供參考。\n使用 /mpe 查看系統狀態。`
      );
    }

  } catch (err) {
    logger.error(`[MPE Telegram] /predict ${symbol} error:`, err);
    await ctx.reply(`❌ 分析 ${symbol} 失敗，請稍後再試`);
  }
}

// ─────────────────────────────────────────
// /backtest [代號] — Historical accuracy
// ─────────────────────────────────────────

export async function handleBacktestCommand(ctx: Context): Promise<void> {
  const text = (ctx.message as { text?: string })?.text ?? '';
  const parts = text.trim().split(/\s+/);
  const symbol = parts[1]?.toUpperCase();

  const filter = symbol
    ? db.collection('mpe_signals').where('symbol', '==', symbol).where('status', 'in', ['TRIGGERED', 'EXPIRED', 'INVALIDATED']).orderBy('timestamp', 'desc').limit(20)
    : db.collection('mpe_signals').where('status', 'in', ['TRIGGERED', 'EXPIRED', 'INVALIDATED']).orderBy('timestamp', 'desc').limit(20);

  try {
    await ctx.reply(`📊 查詢${symbol ? ` ${symbol}` : '全部'} 歷史訊號...`);

    const snap = await filter.get();
    if (snap.empty) {
      await ctx.reply('📭 暫無歷史訊號記錄');
      return;
    }

    const signals = snap.docs.map(d => d.data());
    const triggered = signals.filter(s => s.status === 'TRIGGERED').length;
    const total = signals.length;
    const winRate = total > 0 ? Math.round((triggered / total) * 100) : 0;

    const avgRR   = signals.reduce((a, s) => a + (s.riskReward ?? 0), 0) / total;
    const avgConf = signals.reduce((a, s) => a + (s.confidence ?? 0), 0) / total;

    const msg = [
      `📈 **回測報告${symbol ? ` — ${symbol}` : ' — 全部標的'}**`,
      '',
      `樣本數：${total} 個訊號`,
      `觸發率：${winRate}%（${triggered}/${total}）`,
      `平均 R/R：${avgRR.toFixed(2)}`,
      `平均信心：${Math.round(avgConf)}%`,
      '',
      `（注意：觸發=訊號方向正確，非最終盈利率）`,
    ].join('\n');

    await ctx.reply(msg, { parse_mode: 'Markdown' });

  } catch (err) {
    logger.error('[MPE Telegram] /backtest error:', err);
    await ctx.reply('❌ 回測查詢失敗');
  }
}
