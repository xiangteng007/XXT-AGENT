# 🚚 ST (Super-Teng) 專案全局物理遷移與部署修復 SOP (Migration SOP)

> **編制日期**: 2026-05-17  
> **適用場景**: 將 `C:\Users\xiang\` 下的分散專案（`XXT-AGENT`、`SENTENG-MAIN`、`SENTENG-TELEGRAMBOT`、`senteng-oneclick`）安全且完整地移入統一的超級目錄 `C:\Users\xiang\ST\` 下。

---

## ⚠️ 1. 遷移前置避坑提醒

1. **關閉所有編輯器與執行服務**:  
   在遷移前，請關閉 VS Code、Webstorm、以及所有正在背景運行的開發終端（如 `npm run dev`）。這能避免 Windows 出現「檔案被佔用而無法移動」的錯誤。
2. **備份保證**:  
   此腳本使用 Windows 原生的 `Move-Item`，能 100% 完整保留所有 Git Commit 紀錄與隱藏檔案 (`.git`)。

---

## 💻 2. 一鍵物理遷移指令 (PowerShell)

請打開您的 **Windows PowerShell (以管理員身份執行)**，直接複製並貼上以下代碼塊執行。此腳本將自動創建目錄，並將所有子專案乾淨地移動到 `C:\Users\xiang\ST` 下：

```powershell
# 1. 確保 ST 目錄存在
if (-not (Test-Path "C:\Users\xiang\ST")) {
    New-Item -ItemType Directory -Force -Path "C:\Users\xiang\ST"
}

# 2. 安全搬遷核心專案 (保留 Git 歷史與所有檔案)
$Projects = @("XXT-AGENT", "SENTENG-MAIN", "SENTENG-TELEGRAMBOT", "senteng-oneclick")
foreach ($Proj in $Projects) {
    $Source = "C:\Users\xiang\$Proj"
    $Dest = "C:\Users\xiang\ST\$Proj"
    if (Test-Path $Source) {
        Write-Host "==> 正在遷移 $Proj 至 ST 目錄..." -ForegroundColor Green
        Move-Item -Path $Source -Destination $Dest -Force
    } else {
        Write-Host "==> 警告: 找不到目錄 $Source，略過。" -ForegroundColor Yellow
    }
}

Write-Host "==> 🎉 所有專案已成功統一併入 C:\Users\xiang\ST\ !!" -ForegroundColor Cyan
```

---

## ⚙️ 3. 遷移後的「路徑與一鍵部署」自動化修正

遷移完成後，請依序對以下兩個關鍵設定檔進行修正（我已為您整理好修正對照表）：

### 3.1 一鍵部署腳本路徑修正 (`senteng-oneclick/deploy-senteng-all-oneclick.ps1`)
*   **檔案位置**: `C:\Users\xiang\ST\senteng-oneclick\deploy-senteng-all-oneclick.ps1`
*   **修改對照 (第 25-26 行)**:
    ```powershell
    # ─── 舊版路徑 (Line 25-26) ───
    $LocalFrontendDir = "C:\Users\xiang\senteng-frontend"
    $LocalBackendDir  = "C:\Users\xiang\senteng-backend\backend"

    # ─── 新版路徑 (移入 ST 後的對齊路徑，指向 Nx Monorepo apps) ───
    $LocalFrontendDir = "C:\Users\xiang\ST\SENTENG-MAIN\apps\web"
    $LocalBackendDir  = "C:\Users\xiang\ST\SENTENG-MAIN\apps\api"
    ```

### 3.2 數據更新腳本路徑修正 (`senteng-oneclick/apply-moduleA-projects.ps1`)
*   **檔案位置**: `C:\Users\xiang\ST\senteng-oneclick\apply-moduleA-projects.ps1`
*   **修改對照 (第 3 行)**:
    ```powershell
    # ─── 舊版路徑 (Line 3) ───
    $BackendDir = "C:\Users\xiang\senteng-backend\backend"

    # ─── 新版路徑 ───
    $BackendDir = "C:\Users\xiang\ST\SENTENG-MAIN\apps\api"
    ```

---

## 🎨 4. VS Code 工作區開啟指南

完成搬遷後，您只需要在 VS Code 中選擇：
*   📂 **開啟資料夾 (Open Folder)** -> 選擇 **`C:\Users\xiang\ST`**。

您將能在**同一個 VS Code 視窗**中看見所有的業務與大腦程式碼，不論是提交 Git、備份、還是跨專案修改都變得極起方便與直覺！
