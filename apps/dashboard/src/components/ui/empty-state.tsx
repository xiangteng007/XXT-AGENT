'use client';

import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  /** Lucide icon component */
  icon?: React.ElementType;
  /** Main heading */
  title?: string;
  /** Supporting description */
  description?: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Callback when action is clicked */
  onAction?: () => void;
  /** Compact mode for inline usage */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title = '尚無資料',
  description = '目前沒有可顯示的內容',
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
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
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.06))',
          border: '1px solid rgba(99, 102, 241, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: compact ? 12 : 20,
        }}
      >
        <Icon size={compact ? 22 : 28} color="#6366f1" strokeWidth={1.5} />
      </div>
      <h3
        style={{
          fontSize: compact ? '16px' : '18px',
          fontWeight: 600,
          color: 'var(--text-primary, #1a1a2e)',
          margin: '0 0 6px',
          letterSpacing: '-0.3px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-muted, #64748b)',
          margin: 0,
          maxWidth: '360px',
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 20,
            padding: '8px 20px',
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
          {actionLabel}
        </button>
      )}
    </div>
  );
}
