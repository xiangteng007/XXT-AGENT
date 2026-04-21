export interface AgentData {
  id: string;
  name: string;
  title: string;
  imagePath: string;
  status: 'ONLINE' | 'OFFLINE' | 'STANDBY' | 'SYNCING';
  version: string;
  description: string;
}

export const AGENTS_DATA: AgentData[] = [
  {
    id: 'argus',
    name: 'Argus',
    title: '全域情報官 (Global Intelligence)',
    imagePath: '/agents/argus_360.png',
    status: 'ONLINE',
    version: 'v8.0',
    description: '負責跨維度情報抓取、長期記憶管理與資料合成。',
  },
  {
    id: 'lumi',
    name: 'Lumi',
    title: '室內設計/空間總管 (Spatial Manager)',
    imagePath: '/agents/lumi_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '專精於空間美學、室內設計渲染與環境配置優化。',
  },
  {
    id: 'nova',
    name: 'Nova',
    title: '人資與協調長 (HR & Coordination)',
    imagePath: '/agents/nova_360.png',
    status: 'ONLINE',
    version: 'v8.0',
    description: '核心調度大腦，負責代理人間的技能管理與任務指派。',
  },
  {
    id: 'rusty',
    name: 'Rusty',
    title: '財務/計價總管 (Financial Manager)',
    imagePath: '/agents/rusty_360.png',
    status: 'SYNCING',
    version: 'v8.0',
    description: '掌管總分類帳、採購詢價與企業級精算報告。',
  },
  {
    id: 'titan',
    name: 'Titan',
    title: 'BIM/結構工程 (Structural Engineer)',
    imagePath: '/agents/titan_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '負責建築資訊模型分析、結構安全評估與工程重度計算。',
  },
  {
    id: 'hardware-innovator',
    name: 'Aero',
    title: '無人機硬體架構師',
    imagePath: '/agents/hardware-innovator_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '硬體創新 — 無人機架構設計、感測器整合、電路佈局 (專注民用/搜救領域)',
  },
  {
    id: 'firmware-engineer',
    name: 'Pulse',
    title: '嵌入式韌體工程師',
    imagePath: '/agents/firmware-engineer_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '軟韌體開發 — 飛控韌體撰寫、RTOS 即時系統調校、驅動程式開發、微控制器低延遲通訊協定',
  },
  {
    id: 'forge',
    name: 'Forge',
    title: '先進製造專家 (微型化)',
    imagePath: '/agents/manufacturing-specialist_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '分散式製造專家 — 小型/家用型 CNC 銑削、桌上型 3D 列印參數優化、模組化拆解設計與高強度拼接卡榫工程',
  },
  {
    id: 'matter',
    name: 'Matter',
    title: '應用材料科學家',
    imagePath: '/agents/materials-scientist_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '應用材料研發 — 先進複合材料、金屬加工、聚合物 (PLA/ABS/PETG/樹脂) 及高強度材料開發與應力分析',
  },
  {
    id: 'evolution-researcher',
    name: 'Nexus',
    title: 'AI演化研究員',
    imagePath: '/agents/evolution-researcher_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '演算法先驅 — AI自我升級、神經網路架構研究、數據分析預測',
  },
  {
    id: 'qa-engineer',
    name: 'Aegis',
    title: '測試與可靠度工程師',
    imagePath: '/agents/qa-engineer_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '品質保證 — 破壞性測試、震動與疲勞分析、風洞空氣動力學模擬、平均故障間隔 (MTBF) 計算',
  },
  {
    id: 'rf-engineer',
    name: 'Radar',
    title: '射頻與資安工程師',
    imagePath: '/agents/rf-engineer_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '通訊與安全 — 抗干擾跳頻技術 (FHSS)、微波/衛星通訊、零信任網路架構、資料加密傳輸',
  },
  {
    id: 'hmi-designer',
    name: 'Weaver',
    title: '人機介面設計師',
    imagePath: '/agents/hmi-designer_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '互動設計 — 地面控制站 (GCS) UI/UX 設計、VR/AR 第一人稱遠端遙控視覺化、穿戴式控制裝置',
  },
  {
    id: 'power-engineer',
    name: 'Volt',
    title: '能源與動力專家',
    imagePath: '/agents/power-engineer_360.png',
    status: 'STANDBY',
    version: 'v8.0',
    description: '推進與能源 — 高密度固態電池應用、無刷馬達效率優化、散熱熱流學 (Thermal Dynamics)、電源管理系統 (BMS)',
  }
];
