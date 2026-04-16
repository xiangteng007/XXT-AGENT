import { Router, Request, Response } from 'express';
import { addFeedback, getUnprocessedFeedback, markFeedbackProcessed, saveDirectives, getDirectives } from '../stores/kaizen-store';
import { agentChat } from '../inference-wrapper';
import { logger } from '../logger';

export const kaizenRouter = Router();

/**
 * @openapi
 * /system/kaizen/feedback:
 *   post:
 *     tags: [System]
 *     summary: 新增 Agent 反饋 (Kaizen Feedback)
 */
kaizenRouter.post('/feedback', async (req: Request, res: Response) => {
  const { agent_id, original_context, agent_output, user_correction } = req.body as {
    agent_id?: string;
    original_context?: string;
    agent_output?: string;
    user_correction?: string;
  };

  if (!agent_id || !user_correction) {
    res.status(400).json({ error: 'agent_id and user_correction are required' });
    return;
  }

  const id = await addFeedback(agent_id, original_context ?? '', agent_output ?? '', user_correction);
  res.status(201).json({ ok: true, id, message: 'Feedback stored for future reflection.' });
});

/**
 * @openapi
 * /system/kaizen/reflect/{agent_id}:
 *   post:
 *     tags: [System]
 *     summary: 觸發指定 Agent 進行自我反思，讀取所有未處理的 Feedback 並提煉新守則。
 */
kaizenRouter.post('/reflect/:agent_id', async (req: Request, res: Response) => {
  const agentId = req.params.agent_id;
  const feedbacks = await getUnprocessedFeedback(agentId);

  if (feedbacks.length === 0) {
    res.json({ ok: true, message: 'No unprocessed feedback found. Reflection skipped.' });
    return;
  }

  // Combine old directives and new feedbacks
  const currentDirectives = await getDirectives(agentId);
  const feedbackList = feedbacks.map((f, i) => 
    ` [案例 ${i+1}] 原始輸出：${f.agent_output} \n 人類糾正：${f.user_correction}`
  ).join('\n---\n');

  const metaPrompt = `
你是高級監督者(Meta-Agent)，你的任務是幫助 Agent "${agentId}" 從人類最近的糾正中學習。
以下是這個 Agent 最近犯錯被糾正 ${feedbacks.length} 次的紀錄：
${feedbackList}

目前該 Agent 的舊守則(若有)：
${currentDirectives ?? '(無)'}

請融合舊守則與新被糾正的經驗，提煉出最新版本的「核心行為守則(Directives)」。
這是一組極其簡練、條列式且清晰的鐵律，未來會每次都強制注入這個 Agent 的大腦中。避免贅字。
`;

  try {
    const result = await agentChat([
      { role: 'user', content: metaPrompt }
    ], { 
      agentId: 'meta-kaizen', 
      action: 'KAIZEN_REFLECTION', 
      temperature: 0.2 // Low temp for structured rules
    });

    // Save the new directives
    const newDirectives = result.content;
    await saveDirectives(agentId, newDirectives);
    
    // Mark these as processed
    await markFeedbackProcessed(feedbacks.map(f => f.id));

    logger.info(`[Kaizen] Agent ${agentId} reflected on ${feedbacks.length} feedbacks.`);
    res.json({
      ok: true,
      agent_id: agentId,
      feedbacks_processed: feedbacks.length,
      new_directives: newDirectives
    });
  } catch (error) {
    logger.error(`[Kaizen] Reflection failed for ${agentId}: ${error}`);
    res.status(500).json({ error: 'Reflection process failed' });
  }
});
