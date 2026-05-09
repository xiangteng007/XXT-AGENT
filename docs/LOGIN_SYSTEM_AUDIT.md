# 登入與帳號系統審計

> **審計日期**: 2026-05-04  
> **審計範圍**: Dashboard 認證流程、RBAC、Session 管理

---

## 1. 認證架構

```
使用者請求
    ↓
┌─ app/page.tsx ─────────────────────┐
│  redirect('/butler')               │  ← 根路徑重定向（Batch 2 修復）
└────────────────────────────────────┘
    ↓
┌─ (app)/AppLayoutClient.tsx ────────┐
│  useAuth() → user 存在？            │
│  ├─ 否 → redirect('/login')       │
│  └─ 是 → 渲染 children + Sidebar  │
└────────────────────────────────────┘
    ↓
┌─ app/dashboard/layout.tsx ─────────┐
│  獨立 auth guard（孤立頁面）        │  ← 未在 (app) 路由組內
│  useAuth() → user 存在？            │
│  ├─ 否 → router.push('/login')    │
│  └─ 是 → 渲染 children            │
└────────────────────────────────────┘
```

## 2. 元件清單

| 元件 | 路徑 | 功能 |
|:---|:---|:---|
| `AuthContext` | `lib/AuthContext.tsx` | Firebase Auth Provider, useAuth() hook |
| `ProtectedRoute` | `components/auth/ProtectedRoute.tsx` | 包裝元件, 未驗證→/login |
| `AppLayoutClient` | `(app)/AppLayoutClient.tsx` | AppShell auth guard + sidebar |
| `LoginPage` | `(auth)/login/page.tsx` | OAuth 登入頁 |
| Dashboard Layout | `dashboard/layout.tsx` | 孤立頁面 auth guard |

## 3. 已修復問題

| 問題 | 狀態 | 修復方式 |
|:---|:---|:---|
| Root `/` → 404 | ✅ 已修復 | 新增 `app/page.tsx` redirect |
| RBAC 未驗證 `/dashboard/*` | ✅ 已修復 | 新增 `dashboard/layout.tsx` auth guard |
| Token 互斥 (Mutex) | ✅ KI 記錄 | Unified Token Strategy |
| 401/429 Loop | ✅ KI 記錄 | Structured Auth Error Codes |

## 4. 仍缺失的功能

| 功能 | 優先級 | 說明 |
|:---|:---|:---|
| 密碼重設 | P3 | 目前僅 OAuth，無需密碼重設 |
| MFA (多因素認證) | P2 | Firebase Auth 支援但未啟用 |
| Session 自動延長 | P2 | 目前依賴 Firebase token 自動刷新 |
| Token 過期 UI | P1 | 無「session expired」提示, 直接 redirect |
| 角色型路由保護 | P2 | AppShell 僅檢查 `user` 存在, 未檢查 role |
| Intended Route 記憶 | ⚠️ 部分 | KI 記錄有 ProtectedRoute 的 intended route 邏輯 |

## 5. 安全建議

1. **啟用 Firebase App Check**: 防止未授權的客戶端存取
2. **RBAC 中間件**: 在 API route 加入角色檢查（admin/operator/viewer）
3. **Audit Trail**: 登入/登出事件記錄到 Pub/Sub audit.log
4. **Rate Limiting**: 登入端點加入速率限制（防暴力破解）
