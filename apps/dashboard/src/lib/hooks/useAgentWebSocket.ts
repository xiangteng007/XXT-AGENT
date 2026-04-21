'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useWarRoomStore, type AgentTaskPayload } from '../store/warRoomStore';

export function useAgentWebSocket(customUrl?: string) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const retryCountRef = useRef(0);
    
    const { 
        addMessage, 
        setAgentTyping, 
        setConnectionStatus, 
        setConnectionError, 
        updateAgentTask 
    } = useWarRoomStore();

    const connectWebSocket = useCallback(() => {
        const wsEndpoint = customUrl || process.env.NEXT_PUBLIC_WS_AGENT_URL || 'ws://localhost:3100';

        try {
            const ws = new WebSocket(wsEndpoint);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[AgentWS] Connected to OpenClaw Gateway:', wsEndpoint);
                setConnectionStatus(true);
                setConnectionError(null);
                retryCountRef.current = 0; // Reset retry counter on successful connection
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'openclaw_event') {
                        const clawEvent = data.event;
                        
                        if (clawEvent.type === 'AGENT_STATE_UPDATE') {
                            const { target_agent, payload, source } = clawEvent;
                            const finalAgent = target_agent || 'system';
                            const typedPayload = payload as AgentTaskPayload;

                            // 1. Handle Task Payload if it's from a specialized node or contains structured data
                            if (source === 'investment-brain' || (typedPayload as Record<string, unknown>).structured_data || (typedPayload as Record<string, unknown>).current_step) {
                                updateAgentTask(finalAgent, typedPayload);
                            }

                            // 2. Handle Typing/Processing States
                            const step = (typedPayload as Record<string, unknown>).current_step as string | undefined;
                            if (step && step !== 'complete' && step !== 'chat') {
                                setAgentTyping(finalAgent, `PROCESSING: ${step.toUpperCase()}...`);
                            } else {
                                setAgentTyping(finalAgent, null);
                            }
                            
                            // 3. Handle Chat Messages
                            const msgs = (typedPayload as Record<string, unknown>).messages;
                            if (msgs && Array.isArray(msgs)) {
                                const lastMsg = msgs[msgs.length - 1] as { content?: string };
                                if (lastMsg && lastMsg.content) {
                                    addMessage(finalAgent, {
                                        sender: 'agent',
                                        content: lastMsg.content
                                    });
                                    setAgentTyping(finalAgent, null);
                                    
                                    const store = useWarRoomStore.getState();
                                    if (store.isCommsPanelOpen && store.selectedAgentId !== finalAgent && finalAgent !== 'system') {
                                        store.openCommsPanel(finalAgent);
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('[AgentWS] Message parse error:', err);
                }
            };

            ws.onerror = (error) => {
                console.warn('[AgentWS] WebSocket error:', error);
                setConnectionError('Uplink disruption detected. Retrying...');
            };

            ws.onclose = () => {
                console.log('[AgentWS] Disconnected from OpenClaw Gateway');
                setConnectionStatus(false);
                
                // Exponential backoff strategy
                const baseDelay = 1000; // 1 second
                const maxDelay = 30000; // 30 seconds
                const delay = Math.min(baseDelay * Math.pow(1.5, retryCountRef.current), maxDelay);
                
                setConnectionError(`Uplink severed. Reconnecting in ${(delay / 1000).toFixed(1)}s...`);
                retryCountRef.current += 1;

                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log(`[AgentWS] Attempting to reconnect (Attempt ${retryCountRef.current})...`);
                    connectWebSocket();
                }, delay);
            };
        } catch (err) {
            console.error('[AgentWS] Failed to create WebSocket:', err);
            setConnectionError('Failed to initialize uplink.');
        }
    }, [addMessage, setAgentTyping, setConnectionStatus, setConnectionError, updateAgentTask, customUrl]);

    const sendMessage = useCallback((payload: Record<string, unknown>) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
        } else {
            console.warn('[AgentWS] Cannot send — WebSocket is not open.');
        }
    }, []);

    useEffect(() => {
        connectWebSocket();

        return () => {
            if (wsRef.current) {
                // Remove onclose handler to prevent reconnection loop when unmounting
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connectWebSocket]);

    return { wsRef, sendMessage };
}
