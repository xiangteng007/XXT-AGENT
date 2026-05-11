'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

interface ErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Optional detailed error info */
  detail?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Type of error for icon selection */
  type?: 'network' | 'auth' | 'generic';
  /** Compact mode */
  compact?: boolean;
}

export function ErrorState({
  message = '載入失敗',
  detail,
  onRetry,
  type = 'generic',
  compact = false,
}: ErrorStateProps) {
  const Icon = type === 'network' ? WifiOff : AlertTriangle;
  const iconColor = type === 'auth' ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? '32px 16px' : '64px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: compact ? 48 : 64,
          height: compact ? 48 : 64,
          borderRadius: '16px',
          background: `rgba(${type === 'auth' ? '245, 158, 11' : '239, 68, 68'}, 0.08)`,
          border: `1px solid rgba(${type === 'auth' ? '245, 158, 11' : '239, 68, 68'}, 0.15)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: compact ? 12 : 20,
        }}
      >
        <Icon size={compact ? 22 : 28} color={iconColor} strokeWidth={1.5} />
      </div>
      <h3
        style={{
          fontSize: compact ? '16px' : '18px',
          fontWeight: 600,
          color: 'var(--text-primary, #1a1a2e)',
          margin: '0 0 6px',
        }}
      >
        {message}
      </h3>
      {detail && (
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-muted, #64748b)',
            margin: '0 0 4px',
            maxWidth: '400px',
            lineHeight: 1.5,
          }}
        >
          {detail}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#6366f1',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={14} />
          重試
        </button>
      )}
    </div>
  );
}
