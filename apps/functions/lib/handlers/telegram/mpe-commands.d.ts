/**
 * MPE Telegram Commands
 *
 * /predict [代號]  — 查詢 MPE 預測（即時生成）
 * /signal          — 今日有效訊號列表
 * /mpe             — MPE 系統狀態
 * /backtest [代號] — 歷史訊號準確率（ChromaDB RAG）
 */
type Context = any;
export declare function handleSignalCommand(ctx: Context): Promise<void>;
export declare function handleMpeCommand(ctx: Context): Promise<void>;
export declare function handlePredictCommand(ctx: Context): Promise<void>;
export declare function handleBacktestCommand(ctx: Context): Promise<void>;
export {};
//# sourceMappingURL=mpe-commands.d.ts.map