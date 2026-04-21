import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
}

/** Typed payload for investment-brain node updates */
export interface InvestmentBrainPayload {
  node?: string;
  current_step?: string;
  messages?: Array<{ content: string }>;
  structured_data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Typed payload for Guardian agent updates */
export interface GuardianPayload {
  policy_id?: string;
  ledger_linked?: boolean;
  status?: string;
  messages?: Array<{ content: string }>;
  current_step?: string;
  [key: string]: unknown;
}

/** Typed payload for Accountant agent updates */
export interface AccountantPayload {
  entry_id?: string;
  amount?: number;
  type?: 'income' | 'expense';
  messages?: Array<{ content: string }>;
  current_step?: string;
  [key: string]: unknown;
}

/** Union of all typed agent task payloads */
export type AgentTaskPayload =
  | InvestmentBrainPayload
  | GuardianPayload
  | AccountantPayload
  | Record<string, unknown>;

interface WarRoomState {
  // Connection State
  isConnected: boolean;
  connectionError: string | null;

  // Comms Panel State
  isCommsPanelOpen: boolean;
  selectedAgentId: string | null;
  
  // Chat State
  chatHistory: Record<string, ChatMessage[]>;
  agentTypingStatus: Record<string, string | null>;

  // Task State
  agentTaskPayloads: Record<string, AgentTaskPayload>;

  // Actions
  setConnectionStatus: (isConnected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  openCommsPanel: (agentId: string) => void;
  closeCommsPanel: () => void;
  addMessage: (agentId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setAgentTyping: (agentId: string, status: string | null) => void;
  updateAgentTask: (agentId: string, payload: AgentTaskPayload) => void;
}

export const useWarRoomStore = create<WarRoomState>((set) => ({
  isConnected: false,
  connectionError: null,
  isCommsPanelOpen: false,
  selectedAgentId: null,
  chatHistory: {},
  agentTypingStatus: {},
  agentTaskPayloads: {},

  setConnectionStatus: (isConnected) => set({ isConnected, connectionError: null }),
  setConnectionError: (error) => set({ connectionError: error, isConnected: false }),

  openCommsPanel: (agentId) => 
    set({ isCommsPanelOpen: true, selectedAgentId: agentId }),

  closeCommsPanel: () => 
    set({ isCommsPanelOpen: false, selectedAgentId: null }),

  addMessage: (agentId, message) => 
    set((state) => {
      const currentHistory = state.chatHistory[agentId] || [];
      const newMessage: ChatMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      
      return {
        chatHistory: {
          ...state.chatHistory,
          [agentId]: [...currentHistory, newMessage],
        },
      };
    }),

  setAgentTyping: (agentId, status) => 
    set((state) => ({
      agentTypingStatus: {
        ...state.agentTypingStatus,
        [agentId]: status,
      },
    })),

  updateAgentTask: (agentId, payload) =>
    set((state) => ({
      agentTaskPayloads: {
        ...state.agentTaskPayloads,
        [agentId]: payload,
      },
    })),
}));
