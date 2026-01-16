# Skill: ui-appshell

目標：100% 依 appshell-layout.md 實作 AppShell Layout v3.0

## 硬性規則

- Header 52px fixed, z-index 100
- Sidebar desktop: 52px collapsed / 280px expanded
- MobileBottom 72px (viewport < 901px)
- z-index 層級：Header 100 → Popups 200 → Modal 210 → Drawer 300
- Header Right 順序：WidgetEditControls(owner-only) → 🔔通知 → 👤帳號

## 不得破壞

- 既有 routes/pages
- RBAC `/admins/{uid}` 結構

## 驗收標準

1. Desktop/Mobile 斷點正確切換
2. SidebarSettings 可拖曳排序/顯示隱藏/重置
3. localStorage 保存 sidebar 狀態
4. PopupCard 點擊外部關閉
