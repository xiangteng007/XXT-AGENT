/**
 * ScoutStore — Scout Agent 持久化儲存層 (C-02)
 *
 * 承繼 BaseAgentStore<T>，提供 FlightMission / UAVEquipment / UAVPilot 三種
 * 資料集的雙邊同步（Memory + Firestore）與自動折舊計算。
 *
 * 注意：contact 欄位列為加密欄位，寫入 Firestore 時自動 AES-256-GCM 加密。
 */

import { BaseAgentStore } from '../base-agent-store';

export type MissionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'aborted';
export type MissionType   = 'aerial_photo' | 'inspection' | 'agriculture' | 'survey' | 'rescue_support' | 'other';

export interface FlightMission {
  id: string;                // 必須是 id（BaseAgentStore 要求）
  entity_type?: 'co_drone';
  mission_type:    MissionType;
  title:            string;
  client_name:      string;
  location:         string;
  latitude?:        number;
  longitude?:       number;
  scheduled_start:  string;
  scheduled_end:    string;
  actual_start?:    string;
  actual_end?:      string;
  pilot_id:         string;
  equipment_ids:    string[];
  status:           MissionStatus;
  service_fee?:     number;
  flight_time_mins?:  number;
  area_covered_sqm?:  number;
  weather_condition?: string;
  permit_no?:       string;
  permit_obtained:  boolean;
  rescue_mission_id?: string;
  notes?:           string;
  created_at:       string;
  updated_at:       string;
}

export type EquipmentStatus = 'active' | 'maintenance' | 'retired' | 'damaged';

export interface UAVEquipment {
  id: string;
  entity_type?: 'co_drone';
  brand:            string;
  model:            string;
  serial_no:        string;
  registration_no?: string;
  purchase_date:    string;
  purchase_price:   number;
  current_value:    number;
  status:           EquipmentStatus;
  total_flight_hrs: number;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  battery_cycle_count?: number;
  insurance_policy?:    string;
  created_at: string;
  notes?:     string;
}

export interface UAVPilot {
  id: string;
  name:         string;
  license_type: 'basic' | 'advanced' | 'bvlos' | 'other';
  license_no:   string;
  license_expiry: string;
  contact:      string;    // PRIVATE — auto-encrypted
  is_active:    boolean;
  created_at:   string;
  notes?:       string;
}

// ── Store 實作 ──────────────────────────────────────────────────

export class MissionStore extends BaseAgentStore<FlightMission> {
  constructor() {
    super({
      collectionName: 'scout_missions',
      maxMemoryItems: 2000,
    });
  }
}

export class EquipmentStore extends BaseAgentStore<UAVEquipment> {
  constructor() {
    super({
      collectionName: 'scout_equipment',
      maxMemoryItems: 200,
    });
  }
}

export class PilotStore extends BaseAgentStore<UAVPilot> {
  constructor() {
    super({
      collectionName: 'scout_pilots',
      maxMemoryItems: 100,
      encryptedFields: ['contact'],   // ← 自動 AES-256 加密
    });
  }
}

// ── 全局 Singleton ─────────────────────────────────────────────
export const missionStore    = new MissionStore();
export const equipmentStore  = new EquipmentStore();
export const pilotStore      = new PilotStore();
