# Ollama 本地模型管理策略
# 用途：XXT-AGENT 系統的 GPU 資源優化設定

> **硬體**: NVIDIA RTX 4080 SUPER — 16 GB VRAM  
> **最後更新**: 2026-05-05

---

## 模型庫

| 模型 | 大小 | VRAM | 角色 | 優先級 |
|:---|:---:|:---:|:---|:---:|
| `nemotron-mini:4b` | 2.7 GB | ~3 GB | Intent Router / 輕量對話 | P0 |
| `qwen3:14b` | 9.3 GB | ~10 GB | 主力推理 (Agent 對話) | P1 |
| `nomic-embed-text` | 274 MB | ~0.5 GB | 向量嵌入 (RAG) | P0 |
| `gpt-oss:20b` | 13 GB | ~14 GB | 重量級推理 (分析報告) | P2 |

## VRAM 分配策略

### 模式 A: 常駐模式 (推薦)
- `nemotron-mini:4b` 常駐 (~3 GB)
- `nomic-embed-text` 常駐 (~0.5 GB)
- 剩餘 ~12.5 GB 可隨需載入 `qwen3:14b`

### 模式 B: 全力推理模式
- `qwen3:14b` 獨佔 (~10 GB)
- `nomic-embed-text` 並行 (~0.5 GB)
- 剩餘 ~5.5 GB 用於 KV Cache

### 模式 C: 重量級模式
- `gpt-oss:20b` 獨佔 (~14 GB + CPU offload)
- 僅限單一請求

## 自動卸載設定

在 Ollama 環境變數中設定 (Windows Service 或啟動腳本):

```powershell
# 設定模型閒置 10 分鐘後自動卸載 (預設 5 分鐘)
$env:OLLAMA_KEEP_ALIVE = "10m"

# 或者在 OLLAMA_HOST 啟動時帶入
# 永久設定 (Windows 系統環境變數)
[System.Environment]::SetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "10m", "User")
```

## 健康檢查腳本

```powershell
# 快速檢查 Ollama 狀態
function Test-Ollama {
    try {
        $ps = Invoke-RestMethod -Uri "http://localhost:11434/api/ps" -TimeoutSec 3
        $tags = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 3
        
        Write-Host "✅ Ollama Online"
        Write-Host "   載入模型: $($ps.models.Count)"
        foreach ($m in $ps.models) {
            $vram = [math]::Round($m.size_vram / 1MB)
            Write-Host "   - $($m.name): ${vram} MB VRAM"
        }
        Write-Host "   已安裝: $($tags.models.Count) 個模型"
    } catch {
        Write-Host "❌ Ollama Offline"
    }
}

Test-Ollama
```
