/**
 * privacy-router.test.ts — H-02: PrivacyRouter 單元測試
 *
 * 驗證隱私分類邏輯（H-05 加權評分制）、白名單機制、
 * INTERNAL/PUBLIC 路由決策。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { classify } from './privacy-router';

describe('PrivacyRouter.classify', () => {
  const originalEnv = process.env['PRIVACY_ENFORCE_LOCAL'];

  beforeAll(() => {
    process.env['PRIVACY_ENFORCE_LOCAL'] = 'false';
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env['PRIVACY_ENFORCE_LOCAL'] = originalEnv;
    } else {
      delete process.env['PRIVACY_ENFORCE_LOCAL'];
    }
  });

  // ── PRIVATE 判定測試 ───────────────────────────────────
  describe('PRIVATE scoring', () => {
    it('should classify single high-weight keyword as PRIVATE (score=3)', () => {
      const result = classify('查看我的持倉');
      expect(result.level).toBe('PRIVATE');
      expect(result.routeTo).toBe('local');
    });

    it('should classify multiple low-weight keywords as PRIVATE when score >= 3', () => {
      const result = classify('我目前的血壓和體重還有血糖狀況');
      expect(result.level).toBe('PRIVATE');
      expect(result.routeTo).toBe('local');
    });

    it('should NOT classify a single low-weight keyword as PRIVATE (score=1)', () => {
      const result = classify('維他命可幫助控制血壓');
      expect(result.level).not.toBe('PRIVATE');
    });

    it('should classify PII keywords as PRIVATE', () => {
      const result = classify('我的身分證號碼是什麼');
      expect(result.level).toBe('PRIVATE');
      expect(result.detectedKeywords).toContain('身分證');
    });

    it('should include salary as PRIVATE (high weight)', () => {
      const result = classify('我的薪水多少');
      expect(result.level).toBe('PRIVATE');
    });
  });

  // ── 白名單測試 ─────────────────────────────────────────
  describe('Agent whitelist', () => {
    it('should route whitelisted agent to PUBLIC regardless of keywords', () => {
      const result = classify('查看我的持倉和薪資', undefined, 'titan');
      expect(result.level).toBe('PUBLIC');
    });

    it('should respect whitelist for lumi', () => {
      const result = classify('合約金額多少', undefined, 'lumi');
      expect(result.level).toBe('PUBLIC');
    });

    it('should NOT whitelist non-listed agents', () => {
      const result = classify('查看我的持倉', undefined, 'accountant');
      expect(result.level).toBe('PRIVATE');
    });
  });

  // ── INTERNAL 判定測試 ──────────────────────────────────
  describe('INTERNAL keywords', () => {
    it('should detect construction keywords as INTERNAL', () => {
      const result = classify('計算這間房子的建蔽率');
      expect(result.level).toBe('INTERNAL');
    });

    it('should detect work order keywords as INTERNAL', () => {
      const result = classify('查看今天的工地日誌');
      expect(result.level).toBe('INTERNAL');
    });

    it('should route INTERNAL to cloud when PRIVACY_ENFORCE_LOCAL=false', () => {
      const result = classify('計算建蔽率');
      expect(result.routeTo).toBe('cloud');
    });
  });

  // ── PUBLIC 判定測試 ────────────────────────────────────
  describe('PUBLIC fallthrough', () => {
    it('should classify general queries as PUBLIC', () => {
      const result = classify('今天天氣怎麼樣');
      expect(result.level).toBe('PUBLIC');
    });

    it('should classify English queries as PUBLIC', () => {
      const result = classify('What is the weather today?');
      expect(result.level).toBe('PUBLIC');
    });
  });
});
