'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { AgentData } from '@/lib/constants/agents';
import { DynamicModel } from './DynamicModel';
import { useWarRoomStore } from '@/lib/store/warRoomStore';

interface AgentAvatarProps {
  agent: AgentData;
  position: [number, number, number];
}

const statusColors = {
  ONLINE: '#10b981', // green
  OFFLINE: '#ef4444', // red
  STANDBY: '#f59e0b', // amber
  SYNCING: '#3b82f6', // blue
};

export function AgentAvatar({ agent, position }: AgentAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { openCommsPanel } = useWarRoomStore();
  
  // Add a subtle floating animation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.05;
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    openCommsPanel(agent.id);
  };

  return (
    <group 
      ref={groupRef} 
      position={position} 
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      {/* 3D Model */}
      <DynamicModel 
        modelName={agent.name} 
        fallbackColor={statusColors[agent.status]} 
        position={[0, 0, 0]}
        scale={[1, 1, 1]}
      />

      {/* HTML Label */}
      <Html position={[0, 1.8, 0]} center transform sprite zIndexRange={[100, 0]}>
        <div className="flex flex-col items-center pointer-events-none select-none">
          <div className="bg-[#1a1a1a]/80 backdrop-blur-md border border-[#3d3d3d] px-3 py-1 rounded-md flex flex-col items-center shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-110 hover:border-[#D97706]">
            <span className="text-white font-bold text-sm tracking-wider uppercase">{agent.name}</span>
            <span 
              className="text-[10px] font-mono font-bold" 
              style={{ color: statusColors[agent.status] }}
            >
              {agent.status}
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
}
