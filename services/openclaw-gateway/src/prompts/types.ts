export interface PromptProfile {
  /** Prompt 唯一識別碼，例如 'zora-system' */
  id: string;
  /** 語義化版本號，例如 '1.0.0' */
  version: string;
  /** 人類可讀名稱，例如 '公益法人管家' */
  name: string;
  /** 描述此 Prompt 負責的任務內容 */
  description: string;
  /** 提示詞主體（保留原始變數插值的位置或 RAG 接合點） */
  template: string;
}
