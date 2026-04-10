/**
 * logger.ts — v7.0 結構化日誌模組
 *
 * H-01: 替換原有 console.log 薄封裝，提供：
 *   - JSON 結構化輸出（生產環境，Cloud Run 原生支援）
 *   - 人類可讀輸出（開發環境）
 *   - Log level 過濾（透過 LOG_LEVEL 環境變數）
 *   - Request ID 支援（手動傳入 context）
 *   - 零外部依賴（不引入 pino，避免增加依賴樹）
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env['LOG_LEVEL'] as LogLevel) || (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');

const isProduction = process.env['NODE_ENV'] === 'production';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(
  level: LogLevel,
  msg: string,
  context?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();

  if (isProduction) {
    // JSON 結構化（Cloud Run / Cloud Logging 原生支援）
    const entry: Record<string, unknown> = {
      severity: level.toUpperCase(),
      timestamp,
      message: msg,
    };
    if (context) {
      Object.assign(entry, context);
    }
    return JSON.stringify(entry);
  }

  // 開發環境：人類可讀
  const levelPad = level.toUpperCase().padEnd(5);
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] ${levelPad} ${msg}${contextStr}`;
}

function log(level: LogLevel, msg: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;

  // 若最後一個參數是 object，作為 context 使用
  let context: Record<string, unknown> | undefined;
  const printArgs: unknown[] = [];

  for (const arg of args) {
    if (typeof arg === 'object' && arg !== null && !Array.isArray(arg) && !(arg instanceof Error)) {
      context = { ...context, ...(arg as Record<string, unknown>) };
    } else {
      printArgs.push(arg);
    }
  }

  const formatted = formatMessage(level, msg, context);

  switch (level) {
    case 'error':
      console.error(formatted, ...printArgs);
      break;
    case 'warn':
      console.warn(formatted, ...printArgs);
      break;
    default:
      console.log(formatted, ...printArgs);
  }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
  info: (msg: string, ...args: unknown[]) => log('info', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),

  /** 建立帶有 requestId 的子 logger */
  child: (ctx: Record<string, unknown>) => ({
    debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args, ctx),
    info: (msg: string, ...args: unknown[]) => log('info', msg, ...args, ctx),
    warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args, ctx),
    error: (msg: string, ...args: unknown[]) => log('error', msg, ...args, ctx),
  }),
};
