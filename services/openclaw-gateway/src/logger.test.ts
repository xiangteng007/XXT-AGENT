/**
 * logger.test.ts — H-02: Logger 單元測試
 *
 * 驗證結構化 Logger 的 export contract 與 child logger 功能。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from './logger';

describe('Logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export a logger with standard methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should export a child method for scoped logging', () => {
    expect(typeof logger.child).toBe('function');
  });

  it('should create child loggers with module context', () => {
    const child = logger.child({ module: 'test-module' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
    expect(typeof child.debug).toBe('function');
  });

  it('should not throw when logging with context', () => {
    expect(() => {
      logger.info('test message', { key: 'value' });
    }).not.toThrow();
  });

  it('should not throw when logging errors', () => {
    expect(() => {
      logger.error('test error', new Error('boom'));
    }).not.toThrow();
  });
});
