import { getDb } from '../firestore-client';

export type TurnkeyStatus = 'intake' | 'design' | 'estimation' | 'contract' | 'construction' | 'completed';

export interface TurnkeyProject {
  id: string;
  client_id: string;
  project_name: string;
  status: TurnkeyStatus;
  
  lumi_data?: {
    style: string;
    total_sqm: number;
    renders: string[];
  };
  rusty_data?: {
    estimated_cost_min: number;
    estimated_cost_max: number;
    bom_id?: string;
  };
  lex_data?: {
    contract_id?: string;
    signed: boolean;
  };
  titan_data?: {
    progress_pct: number;
  };
  
  created_at: string;
  updated_at: string;
}

const COLLECTION = 'turnkey_projects';

export async function createTurnkeyProject(project: TurnkeyProject): Promise<void> {
  const db = getDb();
  if (!db) return;
  const ref = db.collection(COLLECTION).doc(project.id);
  await ref.set(project);
}

export async function getTurnkeyProject(id: string): Promise<TurnkeyProject | null> {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as TurnkeyProject;
}

export async function updateTurnkeyProjectState(id: string, updates: Partial<TurnkeyProject>): Promise<void> {
  const db = getDb();
  if (!db) return;
  const ref = db.collection(COLLECTION).doc(id);
  updates.updated_at = new Date().toISOString();
  await ref.update(updates);
}

export async function listActiveTurnkeyProjects(): Promise<TurnkeyProject[]> {
  const db = getDb();
  if (!db) return [];
  const snapshot = await db.collection(COLLECTION)
    .where('status', '!=', 'completed')
    .orderBy('status')
    .orderBy('updated_at', 'desc')
    .limit(50)
    .get();
  return snapshot.docs.map((d: any) => d.data() as TurnkeyProject);
}
