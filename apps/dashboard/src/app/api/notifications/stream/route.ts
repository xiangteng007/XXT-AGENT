/**
 * GET /api/notifications/stream - Server-Sent Events for real-time notifications
 * Streams dashboard events (market alerts, system health, etc.)
 */
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'connected',
        message: '已連線至通知伺服器',
        timestamp: new Date().toISOString(),
      })}\n\n`));

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          })}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Simulate periodic events (in production, replace with real event sources)
      const events = setInterval(() => {
        try {
          const notifications = [
            { type: 'market', title: '市場波動提醒', message: '台積電 (2330) 漲幅超過 2%', severity: 'info' },
            { type: 'system', title: '系統狀態更新', message: '所有服務運行正常', severity: 'success' },
            { type: 'news', title: '新聞快訊', message: '聯準會最新利率決議即將公布', severity: 'warning' },
            { type: 'guardian', title: '保單到期提醒', message: '工程營造綜合保險將於 30 天後到期', severity: 'warning' },
            { type: 'social', title: '社群趨勢', message: '偵測到關鍵字「AI 晶片」討論度上升', severity: 'info' },
          ];
          const event = notifications[Math.floor(Math.random() * notifications.length)];

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            ...event,
            id: `evt-${Date.now()}`,
            timestamp: new Date().toISOString(),
          })}\n\n`));
        } catch {
          clearInterval(events);
        }
      }, 60000); // Every 60 seconds

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clearInterval(events);
        controller.close();
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
