'use client';

import React from 'react';

interface PageSkeletonProps {
  /** Number of skeleton cards to show */
  cards?: number;
  /** Show header skeleton */
  showHeader?: boolean;
  /** Show stats bar skeleton */
  showStats?: boolean;
}

export function PageSkeleton({
  cards = 3,
  showHeader = true,
  showStats = false,
}: PageSkeletonProps) {
  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {showHeader && (
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            className="skeleton-pulse"
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }}
          />
          <div>
            <div
              className="skeleton-pulse"
              style={{
                width: 200,
                height: 20,
                borderRadius: 6,
                marginBottom: 6,
                background: 'rgba(0,0,0,0.06)',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
            <div
              className="skeleton-pulse"
              style={{
                width: 140,
                height: 14,
                borderRadius: 4,
                background: 'rgba(0,0,0,0.04)',
                animation: 'shimmer 1.5s ease-in-out infinite 0.1s',
              }}
            />
          </div>
        </div>
      )}

      {showStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 80,
                borderRadius: 16,
                background: 'rgba(0,0,0,0.03)',
                animation: `shimmer 1.5s ease-in-out infinite ${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 20,
      }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.04)',
              background: 'rgba(255,255,255,0.6)',
              padding: '24px',
              animation: `fadeInUp 0.3s ease-out ${i * 0.08}s both`,
            }}
          >
            <div style={{
              width: '60%',
              height: 16,
              borderRadius: 4,
              background: 'rgba(0,0,0,0.06)',
              marginBottom: 12,
              animation: `shimmer 1.5s ease-in-out infinite ${i * 0.15}s`,
            }} />
            <div style={{
              width: '100%',
              height: 12,
              borderRadius: 4,
              background: 'rgba(0,0,0,0.04)',
              marginBottom: 8,
            }} />
            <div style={{
              width: '80%',
              height: 12,
              borderRadius: 4,
              background: 'rgba(0,0,0,0.03)',
              marginBottom: 16,
            }} />
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              <div style={{
                width: 60,
                height: 24,
                borderRadius: 12,
                background: 'rgba(0,0,0,0.04)',
              }} />
              <div style={{
                width: 48,
                height: 24,
                borderRadius: 12,
                background: 'rgba(0,0,0,0.03)',
              }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
