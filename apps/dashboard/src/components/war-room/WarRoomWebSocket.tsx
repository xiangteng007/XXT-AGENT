'use client';

import { useAgentWebSocket } from '@/lib/hooks/useAgentWebSocket';

export function WarRoomWebSocket() {
  useAgentWebSocket();
  return null;
}
