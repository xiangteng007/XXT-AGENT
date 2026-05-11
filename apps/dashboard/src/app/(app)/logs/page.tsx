'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  FileText,
  RefreshCw,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  Search,
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const LEVEL_CONFIG = {
  info:  { color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  icon: Info,           label: 'INFO'  },
  warn:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: AlertTriangle,  label: 'WARN'  },
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: AlertTriangle,  label: 'ERROR' },
  debug: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: Info,           label: 'DEBUG' },
};

export default function LogsPage() {
  const { getIdToken } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getIdToken();
      if (!token) {
        // No auth — generate synthetic log entries from fused events
        const res = await fetch('/api/admin/fused-events');
        if (res.ok) {
          const data = await res.json();
          const events = (data.events || []).slice(0, 100);
          const synthLogs: LogEntry[] = events.map((evt: { id: string; timestamp: string; sourceAgent: string; priority: string; title: string; rawPayload: Record<string, unknown> }, idx: number) => ({
            id: evt.id || `evt-${idx}`,
            timestamp: evt.timestamp || new Date().toISOString(),
            level: evt.priority === 'HIGH' ? 'warn' : 'info',
            source: evt.sourceAgent || 'system',
            message: evt.title || 'Event recorded',
            metadata: evt.rawPayload,
          }));
          setLogs(synthLogs);
        } else {
          // No events either — show empty
          setLogs([]);
        }
        setLoading(false);
        return;
      }

      // Try the admin fused events API with auth
      const res = await fetch('/api/admin/fused-events', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const events = (data.events || []).slice(0, 200);
        const synthLogs: LogEntry[] = events.map((evt: { id: string; timestamp: string; sourceAgent: string; priority: string; title: string; rawPayload: Record<string, unknown> }, idx: number) => ({
          id: evt.id || `evt-${idx}`,
          timestamp: evt.timestamp || new Date().toISOString(),
          level: evt.priority === 'HIGH' ? 'warn' : evt.priority === 'CRITICAL' ? 'error' : 'info',
          source: evt.sourceAgent || 'system',
          message: evt.title || 'Event recorded',
          metadata: evt.rawPayload,
        }));
        setLogs(synthLogs);
      } else {
        setError(`API 回應 ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError('無法連線到後端服務');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())
      && !log.source.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('zh-TW', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return ts; }
  };

  return (
    <div style={{ padding: '24px 32px 48px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: '16px', marginBottom: '24px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
          }}>
            <FileText size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              系統日誌
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {logs.length > 0 ? `共 ${filteredLogs.length} / ${logs.length} 筆記錄` : '系統活動記錄'}
            </p>
          </div>
        </div>
        <button onClick={loadLogs} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '13px',
          fontWeight: 500, color: '#6366f1', background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, cursor: 'pointer',
        }}>
          <RefreshCw size={14} /> 重新整理
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="搜尋日誌..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 36px', fontSize: '13px',
              borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)',
              background: 'rgba(255,255,255,0.8)', color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
          style={{
            padding: '8px 16px', fontSize: '13px', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)',
            color: 'var(--text-primary)', cursor: 'pointer',
          }}
        >
          <option value="all">全部等級</option>
          <option value="info">INFO</option>
          <option value="warn">WARN</option>
          <option value="error">ERROR</option>
          <option value="debug">DEBUG</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <EmptyState title="載入中..." description="正在讀取系統日誌" />
      ) : error ? (
        <ErrorState message={error} detail="請確認後端服務是否正常" onRetry={loadLogs} type="network" />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="無匹配的日誌記錄"
          description={searchTerm ? '嘗試調整搜尋條件' : '系統尚無活動記錄'}
        />
      ) : (
        <div style={{
          borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)',
          background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)',
          overflow: 'hidden',
        }}>
          {filteredLogs.map((log, idx) => {
            const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
            const LevelIcon = cfg.icon;
            return (
              <div
                key={log.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '12px 20px',
                  borderBottom: idx < filteredLogs.length - 1 ? '1px solid rgba(0,0,0,0.04)' : undefined,
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2,
                }}>
                  <LevelIcon size={14} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
                      color: cfg.color, textTransform: 'uppercase',
                    }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 500 }}>
                      {log.source}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                      <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                    {log.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
