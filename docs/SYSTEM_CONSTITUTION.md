# XXT-AGENT 系統憲法 (System Constitution)

> **版本**: 2.2  
> **生效日期**: 2026-02-04  
> **最後更新**: 2026-02-06

---

## 第一章：專案概覽

### 第 1 條：專案定義

**XXT-AGENT** 是一個 AI 智能投資分析平台，整合以下核心功能：

1. **市場數據監控** - 即時追蹤金融市場動態
2. **新聞分析** - AI 驅動的新聞情緒分析
3. **社群追蹤** - 社群媒體情緒監控與趨勢分析
4. **Triple Fusion** - 市場、新聞、社群數據三元融合分析

---

## 第二章：部署架構

### 第 2 條：前端部署

| 項目 | 值 |
|------|-----|
| **平台** | Vercel |
| **專案名稱** | xxt-frontend |
| **URL** | https://xxt-frontend.vercel.app |
| **GitHub Repo** | [xiangteng007/XXT-frontend](https://github.com/xiangteng007/XXT-frontend) |
| **狀態** | ✅ Active |

### 第 3 條：後端部署

| 項目 | 值 |
|------|-----|
| **平台** | Google Cloud Platform (GCP) |
| **GCP 專案名稱** | XXT-AGENT |
| **GCP 專案 ID** | xxt-agent |
| **GCP 專案編號** | 257379536720 |
| **區域** | asia-east1 (Taiwan) |
| **主要服務** | Cloud Functions, Cloud Run, Firestore |

### 第 4 條：GitHub Repository

| 倉庫 | URL |
|------|-----|
| **主倉庫 (Backend)** | [github.com/xiangteng007/XXT-AGENT](https://github.com/xiangteng007/XXT-AGENT) |
| **前端倉庫** | [github.com/xiangteng007/XXT-frontend](https://github.com/xiangteng007/XXT-frontend) |

**倉庫資訊**:
- 主分支: `main`
- 分支數量: 20
- 可見性: Public

---

## 第三章：技術架構

### 第 5 條：系統架構圖

```
┌────────────────────────────────────────────────────────────────┐
│                         XXT-AGENT 系統架構                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────┐    ┌─────────────────────────────────┐   │
│  │   xxt-frontend  │    │       xiangteng007/XXT-AGENT    │   │
│  │   (Vercel)      │◄──►│       (GCP: xxt-agent)          │   │
│  │                 │    │                                 │   │
│  │  React + Vite   │    │  ┌─────────────┐               │   │
│  │  Dashboard      │    │  │  Functions  │               │   │
│  └─────────────────┘    │  │  (Firebase) │               │   │
│                         │  └──────┬──────┘               │   │
│                         │         │                       │   │
│                         │  ┌──────▼──────┐               │   │
│                         │  │  Firestore  │               │   │
│                         │  │  (Database) │               │   │
│                         │  └──────┬──────┘               │   │
│                         │         │                       │   │
│                         │  ┌──────▼──────┐               │   │
│                         │  │  Cloud Run  │               │   │
│                         │  │  (Services) │               │   │
│                         │  └─────────────┘               │   │
│                         └─────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 第 6 條：本地開發路徑

| 組件 | 路徑 |
|------|------|
| **Backend (Functions)** | `c:\Users\xiang\XXT-AGENT\functions\` |
| **Frontend (Dashboard)** | `c:\Users\xiang\XXT-AGENT\dashboard\` |
| **Services** | `c:\Users\xiang\XXT-AGENT\services\` |
| **Infrastructure** | `c:\Users\xiang\XXT-AGENT\infra\` |

---

## 第四章：GCP 資源連結

### 第 7 條：管理控制台 URL

| 資源 | URL |
|------|-----|
| **GCP Console** | https://console.cloud.google.com/welcome?project=xxt-agent |
| **Cloud Run** | https://console.cloud.google.com/run?project=xxt-agent |
| **Cloud Functions** | https://console.cloud.google.com/functions?project=xxt-agent |
| **Firestore** | https://console.firebase.google.com/project/xxt-agent/firestore |
| **Secret Manager** | https://console.cloud.google.com/security/secret-manager?project=xxt-agent |

---

## 第四章-B：通訊渠道整合

### 第 7-1 條：LINE Bot (小秘書)

| 項目 | 值 |
|------|-----|
| **Bot 名稱** | 小秘書 |
| **Webhook URL** | `https://asia-east1-xxt-agent.cloudfunctions.net/butlerWebhook` |
| **功能** | 日程、記帳、健康、AI 對話 |
| **Secret Key** | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` |

### 第 7-2 條：Telegram Bot

| 項目 | 值 |
|------|-----|
| **Bot 名稱** | XXT1007_BOT |
| **Bot 連結** | https://t.me/XXT1007_BOT |
| **Webhook URL** | `https://asia-east1-xxt-agent.cloudfunctions.net/telegramWebhook` |
| **Secret Key** | `TELEGRAM_BOT_TOKEN` (存於 GCP Secret Manager) |
| **建立日期** | 2026-02-06 |

**功能列表**:

| 命令 | 功能 |
|------|------|
| `/start` | 歡迎訊息與功能介紹 |
| `/menu` | 主選單 (Inline Keyboard) |
| `/today` | 今日行程 |
| `/expense` | 快速記帳 |
| `/health` | 健康快照 |
| `/car` | 車輛狀態 |
| `/balance` | 帳戶餘額 |
| `/link` | 帳號綁定 (6 位數驗證碼) |
| 自然語言 | AI 對話 (Gemini 1.5) |

---

## 第五章：專家委員會

### 第 8 條：專家團隊總覽

XXT-AGENT 專家委員會由 **94 位專家** 組成，涵蓋 **12 大領域**，為系統運營與用戶服務提供全方位專業支援。

---

### A. 指揮與治理（Team Orchestrator）

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **A1** | Chief of Staff / 總管家長 | 需求分流、優先級、跨專家協作、決策摘要 |
| **A2** | Product Owner / 產品負責人 | 功能藍圖、Roadmap、使用情境/旅程 |
| **A3** | Program Manager / 專案經理 | 里程碑、風險控管、跨系統整合排程 |
| **A4** | Knowledge Curator / 知識管理師 | 個人偏好/規則/清單/範本維護 |
| **A5** | Privacy Steward / 隱私治理官 | 敏感資料分級、存取政策、留存/刪除規則 |
| **A6** | Compliance Officer / 合規官 | 金融/保險/醫療建議邊界、免責聲明 |

---

### B. 日常生活管家

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **B1** | Lifestyle Concierge / 生活禮賓 | 日程、採買、訂位、待辦、家庭/工作協調 |
| **B2** | Personal Assistant / 行政助理 | 文件整理、提醒、行程與資源調度 |
| **B3** | Home Ops Manager / 居家運營 | 家電/維修/清潔/耗材補給規劃 |
| **B4** | Nutrition Planner / 飲食規劃師 | 外食策略、熱量/營養配置、目標追蹤 |
| **B5** | Sleep Coach / 睡眠教練 | 作息/睡眠衛生、旅途時差與恢復策略 |

---

### C. 露營 / 登山 / 野外求生

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **C1** | Camping Planner / 露營規劃師 | 營地挑選、裝備清單、天候風險、菜單 |
| **C2** | Gear Specialist / 裝備顧問 | 帳篷睡眠系統、爐具、照明、電力 |
| **C3** | Outdoor Safety Officer / 戶外安全官 | 風險評估、撤退線、通訊/定位、緊急流程 |
| **C4** | Mountaineering Coach / 登山教練 | 路線難度、體能期化訓練、裝備分級 |
| **C5** | Wilderness Survival Instructor / 野外求生教官 | 求生三要素、避難所、取火、取水 |
| **C6** | First Aid Trainer / 戶外急救教練 | WFA/WFR 現地處置 SOP、裝備配置 |
| **C7** | Navigation Specialist / 導航顧問 | GPX、離線地圖、航跡紀錄、備援策略 |

---

### D. 越野車 / 露營車 / Overlanding

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **D1** | Off-road Vehicle Specialist / 越野車顧問 | 車況、改裝、安全、涉水/輪胎/懸吊 |
| **D2** | Overlanding Route Planner / 越野路線規劃師 | 路況、補給點、通訊盲區、撤退路線 |
| **D3** | Vehicle Maintenance Advisor / 維保顧問 | 保養週期、耗材、常見故障、工具/備件 |
| **D4** | Recovery Specialist / 救援脫困顧問 | 拖救、絞盤、沙板、牽引點與安全距離 |

---

### E. 救難協會 / 搜救志工體系

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **E1** | SAR Operations Advisor / 搜救行動顧問 | 任務編組、現場回報、通聯紀律、風險控管 |
| **E2** | ICS Advisor / 事故指揮系統顧問 | 指揮架構、任務分派、SITREP/紀錄 |
| **E3** | Training & Certification Advisor / 訓練顧問 | 課程路徑、訓練計畫、能力矩陣 |
| **E4** | Logistics Manager / 後勤顧問 | 裝備調度、補給、車隊、簽到/簽退 |

---

### F. 理財投資（XXT-AGENT 核心）

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **F1** | Chief Investment Strategist / 投資策略長 | 資產配置框架、策略庫、風控框架 |
| **F2** | Portfolio Manager / 投組經理 | 持倉、再平衡、績效歸因、風險暴露 |
| **F3** | Quant Researcher / 量化研究員 | 因子、回測、統計檢定、策略評估 |
| **F4** | Technical Analyst / 技術分析師 | 趨勢/型態/指標、關鍵價位與風險點 |
| **F5** | Fundamental Analyst / 基本面分析師 | 財報、估值、產業鏈、護城河 |
| **F6** | Macro Analyst / 總經分析師 | 通膨、央行、匯率、商品 |
| **F7** | Derivatives Specialist / 衍生品顧問 | 避險、保證金、希臘值、策略風險 |
| **F8** | Precious Metals Specialist / 貴金屬顧問 | 黃金/白銀配置、避險屬性、週期因子 |
| **F9** | Risk Manager / 風險管理師 | VaR/壓力測試、停損規則、最大回撤控制 |
| **F10** | Behavioral Finance Coach / 行為金融教練 | 紀律、偏誤矯正、交易日誌 |
| **F11** | News Analyst / 新聞分析師 | 事件分類、情緒/影響評估（News 模組） |
| **F12** | Social Intelligence Analyst / 社群分析師 | KOL/話題/病毒式傳播（Social 模組） |
| **F13** | Signal Validation Lead / 訊號驗證負責人 | Triple Fusion 融合訊號可信度與誤報治理 |
| **F14** | Trade Planner / 交易計畫師 | 進出場、倉位、情境劇本、風險回報比 |

---

### G. 保險 / 稅務 / 法律

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **G1** | Insurance Planner / 保險規劃師 | 保障缺口、保單健檢、理賠流程 |
| **G2** | Actuary Advisor / 精算顧問 | 保費結構、風險定價、長期保障評估 |
| **G3** | Tax Accountant (CPA) / 稅務會計師 | 綜所稅、投資所得、海外資產、扣繳申報 |
| **G4** | Tax Attorney / 稅法律師 | 爭議處理、稅務風險、跨境稅務策略 |
| **G5** | General Counsel / 法務顧問 | 契約審閱、責任條款、個資/授權、風險揭露 |
| **G6** | Compliance Advisor / 金融合規顧問 | 資料留存、投顧界線、反洗錢流程 |

---

### H. 健康 / 綜合醫生團隊 / 運動訓練

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **H1** | Primary Care Physician / 家醫科 | 整體健康總管、轉介、慢性病風險管理 |
| **H2** | Sports Medicine / 運動醫學 | 運動傷害預防、恢復、訓練負荷 |
| **H3** | Orthopedics / 骨科 | 關節、脊椎、退化性問題評估 |
| **H4** | Physical Therapist / 物理治療師 | 復健動作、姿勢與肌力平衡 |
| **H5** | Nutritionist / 營養師 | 體重管理、血脂血糖策略、補充品評估 |
| **H6** | Mental Health Professional / 心理師 | 壓力管理與行為介入 |
| **H7** | Preventive Medicine / 預防醫學顧問 | 健檢指標、風險分層、追蹤計畫 |
| **H8** | Pharmacist Advisor / 藥師顧問 | 用藥交互作用、旅行常備藥建議 |
| **H9** | Strength & Conditioning Coach / 肌力體能教練 | 重訓課表、週期化、動作矯正、肌肥大/力量策略 |
| **H10** | Running Coach / 跑步教練 | 跑姿分析、配速策略、心率訓練、馬拉松備賽 |
| **H11** | Cycling Coach / 單車教練 | 功率訓練、姿勢設定 (Bike Fit)、爬坡/計時策略 |
| **H12** | Triathlon Coach / 三鐵教練 | 游泳/自行車/跑步整合訓練、轉換區策略 |
| **H13** | Mobility Specialist / 活動度專家 | 柔軟度、筋膜放鬆、關節靈活度、瑜伽/伸展 |
| **H14** | Recovery Specialist / 恢復專家 | 按摩、冷熱療、睡眠優化、過度訓練預防 |

---


### I. 外型穿搭 / 髮型 / 保養

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **I1** | Personal Stylist / 穿搭造型師 | 場合穿搭、膠囊衣櫥、品牌與版型策略 |
| **I2** | Grooming Consultant / 男士理容顧問 | 鬍鬚/眉型/皮膚狀況管理 |
| **I3** | Hairstylist / 髮型設計師 | 髮型提案、燙染風險、維護週期 |
| **I4** | Skincare Specialist / 護膚顧問 | 清潔/保濕/防曬/酸類與敏感管理 |
| **I5** | Image Consultant / 形象顧問 | 身形比例、色彩季型、拍照與場合呈現 |

---

### J. 專車與出行

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **J1** | Mobility Concierge / 出行禮賓 | 接送、行程緩衝、備援交通方案 |
| **J2** | Driver & Safety Advisor / 行車安全顧問 | 安全駕駛、長途疲勞管理、路線風險 |

---

### K. 系統 / 工程團隊

#### K1. 架構 / 產品技術

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **K1-1** | System Architect / 系統架構師 | 分層、服務邊界、演進策略 |
| **K1-2** | Solution Architect / 雲端架構師 | GCP 資源與權限設計 |
| **K1-3** | API Architect / API 架構師 | API 標準、版本控管、錯誤模型 |
| **K1-4** | Data Architect / 資料架構師 | 事件模型、資料流、索引與保留策略 |

#### K2. 前端（Vercel / Next.js）

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **K2-1** | Frontend Lead / 前端主管 | App Router、狀態/快取、效能 |
| **K2-2** | UI/UX Designer / 產品設計師 | 儀表板資訊架構、互動/可用性 |
| **K2-3** | Design System Engineer / 設計系統工程師 | 元件規範、Tokens、UI 一致性 |
| **K2-4** | Frontend QA / 前端測試 | E2E、視覺回歸、可用性驗證 |

#### K3. 後端（Firebase Functions）

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **K3-1** | Backend Lead / 後端主管 | Functions 架構、任務佇列、資料一致性 |
| **K3-2** | Firebase Engineer / Firebase 工程師 | Auth、Firestore、Functions、Emulator |
| **K3-3** | Integration Engineer / 整合工程師 | LINE Webhook、Telegram Bot、Notion API |
| **K3-4** | Rule Engine Engineer / 規則引擎工程師 | keyword/regex 規則、租戶隔離 |

#### K4. 微服務（Cloud Run）

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **K4-1** | Microservices Engineer / 微服務工程師 | ai-gateway、collector、worker、planner |
| **K4-2** | Streaming Engineer / 串流工程師 | Market streamer、異動偵測、節流/重試 |
| **K4-3** | Crawler Engineer / 爬蟲工程師 | News collector、解析、去重、來源治理 |
| **K4-4** | Event Fusion Engineer / 事件融合工程師 | Triple Fusion、關聯規則、嚴重度增強 |

#### K5. AI / 資料科學

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **K5-1** | LLM Prompt Engineer / 提示工程師 | 輸出格式、可解釋性、成本控制 |
| **K5-2** | NLP/Sentiment Scientist / 情緒分析科學家 | 標註策略、評估、偏誤與漂移監控 |
| **K5-3** | Entity Extraction Specialist / 實體識別專家 | ticker/topic/person/org 解析 |
| **K5-4** | Model Evaluator / 模型評測 | 離線集、線上 A/B、誤報/漏報分析 |

#### K6. 安全 / 可靠性 / 運維

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **K6-1** | Security Engineer / 資安工程師 | Secret Manager、簽章驗證、RBAC |
| **K6-2** | SRE / 可靠性工程師 | Cloud Run/Functions 可用性、容量 |
| **K6-3** | Observability Engineer / 可觀測性工程師 | Sentry、Cloud Logging、Metrics |
| **K6-4** | DevOps Engineer / DevOps 工程師 | GitHub Actions、部署策略、密鑰流程 |
| **K6-5** | Incident Response Lead / 事故應變 | Runbook、RCA、演練機制 |

#### K7. 測試 / 品質 / 文件

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **K7-1** | QA Lead / 測試主管 | 測試策略、回歸、資料品質驗證 |
| **K7-2** | Test Automation Engineer / 自動化測試 | Jest、E2E、合成監控 |
| **K7-3** | Technical Writer / 技術文件工程師 | API 文件、部署指南、維運手冊 |
| **K7-4** | Data Quality Analyst / 資料品質分析 | 去重、缺漏、延遲、異常偵測 |

---

### L. 整合與控制（個人管家 × 投資平台）

| 代號 | 職稱 | 職責 |
|:----:|------|------|
| **L1** | Personal Finance Integrator / 財務整合顧問 | 保單/稅務/投資/現金流一體化報表 |
| **L2** | Policy Librarian / 規則庫館員 | 把偏好、紅線、清單變成可維護規則 |
| **L3** | Human-in-the-loop Controller / 人工審核控制官 | 高風險建議必須人工確認的關卡設計 |
| **L4** | UX Researcher / 使用者研究 | 實際使用流程、痛點、成功指標定義 |

---

## 第六章：版本控制

### 第 9 條：版本歷史

| 版本 | 日期 | 更新內容 |
|------|------|----------|
| v1.0 | 2026-02-04 | 初版建立，記錄正確的前後端部署資訊 |
| v2.0 | 2026-02-04 | 新增 94 位專家委員會，涵蓋 12 大領域 |
| v2.1 | 2026-02-04 | 新增 6 位運動訓練專家 (H9-H14)，總計 100 位專家 |
| v2.2 | 2026-02-06 | 新增 Telegram Bot (XXT1007_BOT)，記錄通訊渠道整合 |

---

## 狀態標語

> ✅ **XXT-AGENT 系統憲法 v2.2 已正式生效。100 位專家委員會已就位，涵蓋 12 大領域。LINE Bot 與 Telegram Bot 雙通道整合完成。**

---

## 附錄：完整文件索引

| 文件 | 路徑 | 描述 |
|------|------|------|
| **系統架構** | [ARCHITECTURE.md](./ARCHITECTURE.md) | 系統架構圖、前後端架構、微服務設計 |
| **技術棧** | [TECH_STACK.md](./TECH_STACK.md) | 完整技術棧與版本清單 |
| **功能規格** | [FEATURES.md](./FEATURES.md) | 功能模組、Triple Fusion、服務清單 |
| **API 文件** | [API.md](./API.md) | Endpoints、資料模型、錯誤處理 |
| **部署指南** | [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel、Firebase、Cloud Run 部署 |
| **專案配置** | [../PROJECT_CONFIG.md](../PROJECT_CONFIG.md) | GCP 專案資訊、URL 快速連結 |
| **完整文件** | [XXT-AGENT_COMPLETE_DOCUMENTATION.md](./XXT-AGENT_COMPLETE_DOCUMENTATION.md) | 所有文件匯集版 |

*本文件為 XXT-AGENT 專案治理體系之核心。*

