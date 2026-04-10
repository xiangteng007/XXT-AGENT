/**
 * LexStore — Lex Agent 合約管家持久化儲存層 (C-04)
 *
 * 存放合約（Contract）與文件（DocHubItem）兩種實體。
 * 合約為商業機密等級（PRIVATE），無加密欄位（合約文字由 file_ref 外部存取），
 * DocHubItem 的 file_ref 可選加密（啟用 STORE_ENCRYPTION_KEY 時）。
 */

import { BaseAgentStore } from '../base-agent-store';
import type { EntityType } from '../entity';

export type ContractType    = 'owner' | 'subcontract' | 'design' | 'service' | 'purchase' | 'lease' | 'nda' | 'other';
export type ContractStatus  = 'draft' | 'review' | 'active' | 'completed' | 'disputed' | 'terminated';

export interface PaymentMilestone {
  milestone_id:  string;
  label:         string;
  due_date:      string;
  amount:        number;
  percentage?:   number;
  is_paid:       boolean;
  paid_date?:    string;
}

export interface Contract {
  id: string;                // ← BaseAgentStore 要求 id 欄位
  entity_type:     EntityType;
  contract_type:   ContractType;
  title:           string;
  counterparty:    string;
  counterparty_tax_id?: string;
  total_amount:    number;
  currency:        'NTD' | 'USD' | 'other';
  sign_date:       string;
  effective_date:  string;
  expiry_date?:    string;
  status:          ContractStatus;
  milestones:      PaymentMilestone[];
  warranty_months?:    number;
  liability_cap?:      number;
  penalty_clause?:     string;
  project_id?:         string;
  related_contract_id?: string;
  file_ref?:           string;
  notes?:              string;
  created_at:          string;
  updated_at:          string;
}

export type DocCategory = 'business_license' | 'permit' | 'insurance_policy' | 'certification' | 'design_doc' | 'contract_file' | 'correspondence' | 'other';

export interface DocHubItem {
  id: string;
  entity_type:  EntityType;
  category:     DocCategory;
  title:        string;
  issuer?:      string;
  issue_date?:  string;
  expiry_date?: string;
  doc_no?:      string;
  file_ref?:    string;   // 若啟用加密，此欄位會被加密
  notes?:       string;
  created_at:   string;
}

// ── Store 實作 ──────────────────────────────────────────────────

export class ContractStore extends BaseAgentStore<Contract> {
  constructor() {
    super({
      collectionName: 'lex_contracts',
      maxMemoryItems: 1000,
    });
  }
}

export class DocHubStore extends BaseAgentStore<DocHubItem> {
  constructor() {
    super({
      collectionName: 'lex_documents',
      maxMemoryItems: 1000,
      encryptedFields: ['file_ref'],  // ← 文件路徑/URL 加密存放
    });
  }
}

export const contractStore = new ContractStore();
export const docHubStore   = new DocHubStore();
