# NPM 依賴漏洞審計 SOP

> **最後更新**: 2026-05-04  
> **套件管理器**: pnpm 9.x  
> **已知狀態**: 12 個待修漏洞（主要來自 Firebase SDK 間接依賴）

---

## 1. 審計執行

```bash
# 基本審計（輸出至終端）
pnpm audit

# 若 pnpm audit 在本機 hang（已知問題），使用 JSON 輸出
pnpm audit --json > audit-report.json

# 只顯示 moderate 及以上嚴重程度
pnpm audit --audit-level=moderate

# 針對特定 workspace
pnpm --filter @xxt-agent/dashboard audit
pnpm --filter @xxt-agent/functions audit
```

## 2. 自動修復

```bash
# 嘗試自動修復
pnpm audit --fix

# 若無法自動修復，手動升級有漏洞的依賴
pnpm update <package-name> --latest

# 檢查有無 breaking changes
pnpm outdated
```

## 3. 已知漏洞白名單

以下漏洞來自 Firebase SDK 間接依賴，暫不可修復（需等待 Firebase 官方更新）：

| 漏洞 | 來源 | 嚴重性 | 狀態 |
|:---|:---|:---|:---|
| protobufjs | firebase-admin → @google-cloud/* | moderate | 等待上游修復 |
| undici | firebase-functions → node-fetch | moderate | 等待上游修復 |

> **注意**: 這些漏洞存在於開發依賴或 Server-Side 程式中，不影響使用者瀏覽器環境。

## 4. CI 整合建議

```yaml
# .github/workflows/audit.yml
name: Security Audit
on:
  schedule:
    - cron: '0 9 * * 1'  # 每週一 9:00 UTC
  push:
    paths: ['pnpm-lock.yaml']

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm audit --audit-level=high
        continue-on-error: true
      - run: pnpm audit --json > audit-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: audit-report
          path: audit-report.json
```

## 5. 定期維護

| 頻率 | 動作 |
|:---|:---|
| 每週 | `pnpm audit` 確認無新增 high/critical |
| 每月 | `pnpm outdated` → 升級 minor/patch |
| 每季 | 評估 major 版本升級（Firebase, Next.js） |
