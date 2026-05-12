/**
 * POST /api/chat — Multi-agent chat via AI Gateway
 * 
 * Proxies chat messages to the OpenClaw Gateway for real AI responses.
 * Falls back to a simple echo when the gateway is unreachable.
 */
import { NextResponse } from 'next/server';
import { gatewayFetch } from '@/app/api/market/_gateway';

// Agent system prompts for personality
const AGENT_PROMPTS: Record<string, string> = {
  argus: '你是 Argus，一個專精情報分析和跨維度數據整合的 AI 特工。以精確、分析性的語氣回應。回應請使用繁體中文。',
  lumi: '你是 Lumi，一個專精空間設計和視覺化的 AI 助理。以創意、美學導向的語氣回應。回應請使用繁體中文。',
  nova: '你是 Nova，一個專精任務協調和人力資源管理的 AI 協調員。以高效、組織化的語氣回應。回應請使用繁體中文。',
  rusty: '你是 Rusty，一個專精財務分析和會計的 AI 財務專家。以嚴謹、數據導向的語氣回應。回應請使用繁體中文。',
  titan: '你是 Titan，一個專精結構工程和建築分析的 AI 工程師。以專業、技術導向的語氣回應。回應請使用繁體中文。',
};

export async function POST(req: Request) {
  try {
    const { agentId, message } = await req.json();

    if (!agentId || !message) {
      return NextResponse.json({ error: 'Missing agentId or message' }, { status: 400 });
    }

    const systemPrompt = AGENT_PROMPTS[agentId] || '你是一個專業的 AI 助理。請使用繁體中文回應。';

    // Try real AI via OpenClaw Gateway
    try {
      const res = await gatewayFetch('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'auto',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          return NextResponse.json({ message: reply, source: 'ai-gateway' });
        }
      }
    } catch {
      // Gateway unreachable — fall through to fallback
    }

    // Fallback: echo with agent context (no mock pretend-AI)
    return NextResponse.json({
      message: `[${agentId.toUpperCase()}] 目前 AI 服務暫時離線。您的訊息「${message.slice(0, 50)}...」已記錄，服務恢復後將回覆。`,
      source: 'fallback',
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
