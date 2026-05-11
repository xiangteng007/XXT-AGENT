/**
 * GET /api/notifications/stream - Server-Sent Events for real-time notifications
 * Streams dashboard events from Firestore (fused_events collection)
 * Falls back to heartbeat-only mode if no credentials available
 */
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lazy-load Firestore to avoid cold start penalty
async function getFirestoreDb() {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    return getAdminDb();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'connected',
        message: '已連線至通知伺服器',
        timestamp: new Date().toISOString(),
      })}\n\n`));

      // Heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          })}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Track last seen event timestamp to avoid duplicates
      let lastSeenTs = new Date().toISOString();

      // Poll Firestore for new fused_events every 30s
      const db = await getFirestoreDb();
      const pollEvents = db ? setInterval(async () => {
        try {
          const snapshot = await db
            .collection('fused_events')
            .where('ts', '>', lastSeenTs)
            .orderBy('ts', 'desc')
            .limit(5)
            .get();

          if (!snapshot.empty) {
            for (const doc of snapshot.docs) {
              const data = doc.data();
              const event = {
                id: doc.id,
                type: mapDomainToType(data.domain),
                title: data.title || '系統通知',
                message: data.summary || data.title || '',
                severity: mapSeverity(data.severity),
                domain: data.domain,
                timestamp: data.ts || new Date().toISOString(),
              };

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }

            // Update watermark
            const latest = snapshot.docs[0].data();
            if (latest.ts) {
              lastSeenTs = latest.ts;
            }
          }
        } catch (err) {
          console.error('SSE poll error:', err);
        }
      }, 30000) : null;

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        if (pollEvents) clearInterval(pollEvents);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function mapDomainToType(domain?: string): string {
  switch (domain) {
    case 'market': return 'market';
    case 'news': return 'news';
    case 'social': return 'social';
    case 'guardian': return 'guardian';
    case 'system': return 'system';
    default: return 'system';
  }
}

function mapSeverity(severity?: number): string {
  if (!severity || severity <= 3) return 'info';
  if (severity <= 5) return 'warning';
  return 'error';
}
