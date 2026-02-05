'use client';

import React, { useRef, useEffect } from 'react';

interface PopupCardProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
    children: React.ReactNode;
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    width?: number | string;
}

/**
 * PopupCard Component
 * 
 * Generic popup card that positions relative to anchor and closes on outside click.
 * z-index 200 per AppShell layout spec.
 */
export function PopupCard({
    isOpen,
    onClose,
    anchorRef,
    children,
    position = 'bottom-right',
    width = 320,
}: PopupCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                // Also check if click is on anchor
                if (anchorRef?.current && anchorRef.current.contains(e.target as Node)) {
                    return;
                }
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose, anchorRef]);

    if (!isOpen) return null;

    const positionStyles: React.CSSProperties = {
        position: 'absolute',
        zIndex: 200,
        width: typeof width === 'number' ? `${width}px` : width,
    };

    // Position relative to anchor or default positions
    switch (position) {
        case 'bottom-left':
            positionStyles.top = '100%';
            positionStyles.left = 0;
            positionStyles.marginTop = '8px';
            break;
        case 'bottom-right':
            positionStyles.top = '100%';
            positionStyles.right = 0;
            positionStyles.marginTop = '8px';
            break;
        case 'top-left':
            positionStyles.bottom = '100%';
            positionStyles.left = 0;
            positionStyles.marginBottom = '8px';
            break;
        case 'top-right':
            positionStyles.bottom = '100%';
            positionStyles.right = 0;
            positionStyles.marginBottom = '8px';
            break;
    }

    return (
        <div
            ref={cardRef}
            style={{
                ...positionStyles,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                overflow: 'hidden',
            }}
            role="dialog"
            aria-modal="true"
        >
            {children}
        </div>
    );
}

export default PopupCard;
