/**
 * useNotifications - SSE-based real-time notification hook
 * Connects to /api/notifications/stream for live dashboard events
 */
import { useEffect, useState, useCallback, useRef } from 'react';

export interface Notification {
  id: string;
  type: 'market' | 'system' | 'news' | 'guardian' | 'social' | 'connected' | 'heartbeat';
  title?: string;
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read?: boolean;
}

export function useNotifications(maxItems = 50) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (eventSourceRef.current) return;

    try {
      const es = new EventSource('/api/notifications/stream');
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Notification;

          if (data.type === 'connected') {
            setConnected(true);
            return;
          }
          if (data.type === 'heartbeat') return;

          setNotifications(prev => {
            const updated = [{ ...data, read: false }, ...prev];
            return updated.slice(0, maxItems);
          });
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;
        // Reconnect after 5s
        setTimeout(connect, 5000);
      };
    } catch {
      setConnected(false);
    }
  }, [maxItems]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    notifications,
    connected,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    connect,
    disconnect,
  };
}
