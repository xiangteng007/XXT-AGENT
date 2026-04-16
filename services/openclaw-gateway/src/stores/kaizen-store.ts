import { getDb } from '../firestore-client';
import * as crypto from 'crypto';

export interface KaizenFeedback {
  id: string;
  agent_id: string;           // e.g., 'rusty', 'lumi'
  original_context: string;   // The task or message the agent was working on
  agent_output: string;       // What the agent produced
  user_correction: string;    // What the user corrected it to, or qualitative feedback
  created_at: string;
  processed: boolean;         // Has this feedback been reflected on?
}

export interface KaizenDirective {
  agent_id: string;
  compiled_directives: string; // The synthesized rules
  updated_at: string;
  version: number;
}

export async function addFeedback(
  agentId: string, 
  originalContext: string, 
  agentOutput: string, 
  userCorrection: string
): Promise<string> {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');

  const id = crypto.randomUUID();
  const feedback: KaizenFeedback = {
    id,
    agent_id: agentId,
    original_context: originalContext,
    agent_output: agentOutput,
    user_correction: userCorrection,
    created_at: new Date().toISOString(),
    processed: false,
  };

  await db.collection('kaizen_feedbacks').doc(id).set(feedback);
  return id;
}

export async function getUnprocessedFeedback(agentId: string): Promise<KaizenFeedback[]> {
  const db = getDb();
  if (!db) return [];
  
  const snapshot = await db.collection('kaizen_feedbacks')
    .where('agent_id', '==', agentId)
    .where('processed', '==', false)
    .get();

  return snapshot.docs.map(doc => doc.data() as KaizenFeedback);
}

export async function markFeedbackProcessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  const batch = db.batch();
  for (const id of ids) {
    batch.update(db.collection('kaizen_feedbacks').doc(id), { processed: true });
  }
  await batch.commit();
}

export async function saveDirectives(agentId: string, newDirectives: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  const docRef = db.collection('kaizen_directives').doc(agentId);
  const doc = await docRef.get();
  
  const version = doc.exists ? ((doc.data()?.version || 0) + 1) : 1;
  const data: KaizenDirective = {
    agent_id: agentId,
    compiled_directives: newDirectives,
    updated_at: new Date().toISOString(),
    version,
  };

  await docRef.set(data);
}

export async function getDirectives(agentId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection('kaizen_directives').doc(agentId).get();
  if (!doc.exists) return null;
  return doc.data()?.compiled_directives as string;
}
