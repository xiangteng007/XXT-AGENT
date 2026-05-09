import React from 'react';

interface GlassPanelProps {
    children: React.ReactNode;
    className?: string;
    withShine?: boolean;
}

export function GlassPanel({ children, className = '', withShine = false }: GlassPanelProps) {
    return (
        <div 
            className={`
                relative overflow-hidden rounded-xl border border-white/5 
                bg-[#2a2928]/60 backdrop-blur-xl p-8 
                transition-all duration-500 hover:border-gold/20 hover:shadow-[0_8px_30px_rgba(212,175,55,0.1)] hover:-translate-y-1
                ${className}
            `}
        >
            {withShine && (
                <div 
                    className="absolute inset-0 z-0 pointer-events-none opacity-20"
                    style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        transform: 'skewX(-20deg) translateX(-150%)',
                        animation: 'glassShine 6s infinite'
                    }}
                />
            )}
            <div className="relative z-10">
                {children}
            </div>
            
            <style jsx>{`
                @keyframes glassShine {
                    0% { transform: skewX(-20deg) translateX(-150%); }
                    20% { transform: skewX(-20deg) translateX(250%); }
                    100% { transform: skewX(-20deg) translateX(250%); }
                }
            `}</style>
        </div>
    );
}
