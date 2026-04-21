import { openClawGateway } from './openclaw';

export interface WarRoomSession {
  sessionId: string;
  topic: string;
  participants: string[];
  messages: Array<{ agent: string; content: string; timestamp: Date }>;
  status: 'ACTIVE' | 'RESOLVED' | 'ESCALATED';
  resolutionSummary?: string;
}

class WarRoomOrchestrator {
  private activeSessions: Map<string, WarRoomSession> = new Map();

  /**
   * Initiates a multi-agent debate session based on a critical intelligence report.
   */
  public async initiateSession(topic: string, agents: string[], baseIntelligence: any): Promise<string> {
    const sessionId = `WAR-ROOM-${Date.now()}`;
    const session: WarRoomSession = {
      sessionId,
      topic,
      participants: ['Argus', ...agents],
      messages: [
        {
          agent: 'Argus',
          content: `[CRITICAL ALERT] ${baseIntelligence.summary}. I am summoning ${agents.join(' and ')} for immediate impact analysis.`,
          timestamp: new Date()
        }
      ],
      status: 'ACTIVE'
    };

    this.activeSessions.set(sessionId, session);
    console.log(`[WarRoom] 🔴 Session Initiated: ${topic}`);
    
    // Broadcast the initiation to the participants
    await openClawGateway.emit('WAR_ROOM_INITIATED', session);

    return sessionId;
  }

  /**
   * Receives a response from an agent in the War Room and pushes the state forward.
   */
  public async handleAgentResponse(sessionId: string, agentId: string, response: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'ACTIVE') return;

    console.log(`[WarRoom] ${agentId} contributed to session: ${response.substring(0, 50)}...`);
    session.messages.push({ agent: agentId, content: response, timestamp: new Date() });

    // Mock logic: If all summoned agents have responded, reach consensus.
    const uniqueResponders = new Set(session.messages.map(m => m.agent));
    if (session.participants.every(p => uniqueResponders.has(p))) {
      await this.resolveSession(sessionId);
    }
  }

  /**
   * Finalizes the debate and broadcasts the consensus.
   */
  private async resolveSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'RESOLVED';
    session.resolutionSummary = `[Consensus Reached] ${session.participants.join(', ')} have aligned. Proceeding with mitigation strategy.`;
    
    console.log(`[WarRoom] 🟢 Session Resolved: ${sessionId}`);
    await openClawGateway.emit('CONSENSUS_REACHED', session);
  }
}

export const warRoom = new WarRoomOrchestrator();
