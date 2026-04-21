// OpenClaw Gateway (Argus v2.0 - War Room Integration)

type EventType = 
  | 'INTELLIGENCE_DISCOVERED' 
  | 'WAR_ROOM_INITIATED' 
  | 'AGENT_RESPONSE_RECEIVED' 
  | 'CONSENSUS_REACHED'
  | 'TASK_QUEUED' 
  | 'LOCAL_RUNNER_UNCONFIGURED'
  | 'SKILL_PROPOSAL'         // 發生於 Nova 從網路抓取新包
  | 'SKILL_APPROVED'         // User 核准後廣播全域 Agent 更新參數
  | 'BANK_WEBHOOK_RECEIVED'  // [預留] 銀行 API Webhook 回調 (如：入帳通知)
  | 'FINANCIAL_TRANSACTION_SYNC'; // [預留] 資金進出與對帳系統同步指令

class OpenClawGateway {
  public async emit(eventType: EventType, payload: any) {
    console.log(`[OpenClaw Gateway] Event Received: ${eventType}`);
    
    if (eventType === 'INTELLIGENCE_DISCOVERED') {
      const targetAgents = payload.impactedAgents || [];
      console.log(`[OpenClaw] Dispatching high-priority Intel to: ${targetAgents.join(', ')}`);
      // Phase 4: Automatically trigger a War Room instead of just passive broadcast if threat is CRITICAL
      if (payload.threatLevel === 'CRITICAL' || payload.threatLevel === 'HIGH') {
        const { warRoom } = require('./war_room');
        await warRoom.initiateSession(`Emergency: ${payload.category}`, targetAgents, payload);
      }
    } else if (eventType === 'WAR_ROOM_INITIATED') {
      console.log(`[OpenClaw] War Room Active! All relevant Agents have been summoned.`);
    } else if (eventType === 'CONSENSUS_REACHED') {
      console.log(`[OpenClaw] War Room Resolved. Resolution: ${payload.resolutionSummary}`);
      // Send resolution back to User Dashboard
    }
  }

  public subscribe(eventType: EventType, callback: Function) {
    // Subscriber logic placeholder
  }
}

export const openClawGateway = new OpenClawGateway();
