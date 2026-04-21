'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useWarRoomStore } from '@/lib/store/warRoomStore';
import { Send, Loader2 } from 'lucide-react';
import { AGENTS_DATA } from '@/lib/constants/agents';
import { MaterialCalculatorWidget } from './MaterialCalculatorWidget';
import { HRWidget } from './HRWidget';
import { BankingWidget } from './BankingWidget';

interface AgentChatProps {
  agentId: string;
}

export function AgentChat({ agentId }: AgentChatProps) {
  const [input, setInput] = useState('');
  const { chatHistory, addMessage, agentTypingStatus, setAgentTyping } = useWarRoomStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const messages = useMemo(() => chatHistory[agentId] || [], [chatHistory, agentId]);
  const agent = AGENTS_DATA.find((a) => a.id === agentId);
  const currentTypingStatus = agentTypingStatus[agentId];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentTypingStatus]);

  // Initial greeting if no messages
  useEffect(() => {
    if (messages.length === 0 && agent) {
      addMessage(agentId, {
        sender: 'system',
        content: `UPLINK ESTABLISHED WITH ${agent.name.toUpperCase()} // WAITING FOR DIRECTIVE...`,
      });
    }
  }, [agentId, messages.length, agent, addMessage]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to store
    addMessage(agentId, { sender: 'user', content: userMessage });

    // Set typing state
    setAgentTyping(agentId, 'ROUTING...');

    try {
      // Call OpenClaw gateway endpoint directly
      const gatewayUrl = process.env.NEXT_PUBLIC_OPENCLAW_URL || 'http://localhost:3100';
      const response = await fetch(`${gatewayUrl}/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_agent: agentId,
          message: userMessage,
          session_id: 'war-room',
          user_id: 'operator',
          history: messages.filter(m => m.sender !== 'system').map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // We do not add the agent's message or set typing to false here.
      // The useAgentWebSocket hook will receive the AGENT_STATE_UPDATE event
      // and update the store accordingly.
    } catch (error) {
      console.error('Chat error:', error);
      addMessage(agentId, { 
        sender: 'system', 
        content: 'ERROR: COMMUNICATION LINK DISRUPTED. PLEASE RETRY.' 
      });
      setAgentTyping(agentId, null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#121212]/80 rounded border border-[#3d3d3d]/50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
          >
            <div 
              className={`p-3 rounded backdrop-blur-md ${
                msg.sender === 'user' 
                  ? 'bg-[#D97706]/20 border border-[#D97706]/50 text-[#f5f5f5]' 
                  : msg.sender === 'system'
                    ? 'bg-[#1a1a1a] border border-[#ef4444]/50 text-[#ef4444]'
                    : 'bg-[#1a1a1a]/80 border border-[#3d3d3d] text-[#e5e7eb]'
              }`}
            >
              {(() => {
                // Check if message has a JSON block for a widget
                const widgetMatch = msg.content.match(/```json\n([\s\S]*?)\n```/);
                if (widgetMatch) {
                  try {
                    const data = JSON.parse(widgetMatch[1]);
                    if (data.__widget === 'MaterialCalculator') {
                      const textContent = msg.content.replace(widgetMatch[0], '').trim();
                      return (
                        <div className="flex flex-col gap-2">
                          {textContent && <div>{textContent}</div>}
                          <MaterialCalculatorWidget calculationType={data.calculationType} data={data.data} />
                        </div>
                      );
                    } else if (data.__widget === 'HRWidget') {
                      const textContent = msg.content.replace(widgetMatch[0], '').trim();
                      return (
                        <div className="flex flex-col gap-2">
                          {textContent && <div>{textContent}</div>}
                          <HRWidget calculationType={data.calculationType} data={data.data} />
                        </div>
                      );
                    } else if (data.__widget === 'BankingWidget') {
                      const textContent = msg.content.replace(widgetMatch[0], '').trim();
                      return (
                        <div className="flex flex-col gap-2">
                          {textContent && <div>{textContent}</div>}
                          <BankingWidget actionType={data.actionType} data={data.data} />
                        </div>
                      );
                    }
                  } catch (e) {
                    // Ignore parsing errors, fallback to normal display
                  }
                }
                return msg.content;
              })()}
            </div>
          </div>
        ))}
        
        {currentTypingStatus && (
          <div className="flex flex-col max-w-[85%] mr-auto items-start">
            <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
              <span className="uppercase text-[#D97706]">{agent?.name}</span>
            </div>
            <div className="p-3 rounded backdrop-blur-md bg-[#1a1a1a]/80 border border-[#3d3d3d] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D97706]" />
              <span className="text-[#9ca3af] animate-pulse">{currentTypingStatus}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#3d3d3d]/50 bg-[#1a1a1a]/50">
        <div className="relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ENTER DIRECTIVE..."
            className="w-full bg-[#0a0a0a] border border-[#3d3d3d] rounded p-3 pr-12 text-[#f5f5f5] font-mono text-sm focus:outline-none focus:border-[#D97706] focus:ring-1 focus:ring-[#D97706] resize-none h-12 overflow-hidden"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !!currentTypingStatus}
            className="absolute right-2 p-2 text-[#9ca3af] hover:text-[#D97706] disabled:opacity-50 disabled:hover:text-[#9ca3af] transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
