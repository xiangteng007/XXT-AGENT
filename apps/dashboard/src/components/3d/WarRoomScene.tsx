'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import { AgentAvatar } from './AgentAvatar';
import { AGENTS_DATA } from '@/lib/constants/agents';

export function WarRoomScene() {
  // Distribute agents in a circle around the center
  const radius = 3;
  const positions = AGENTS_DATA.map((agent, index) => {
    const angle = (index / AGENTS_DATA.length) * Math.PI * 2;
    return [
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    ] as [number, number, number];
  });

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 4, 8], fov: 45 }}>
        <color attach="background" args={['#0a0a0a']} />
        <fog attach="fog" args={['#0a0a0a', 5, 25]} />
        
        {/* Sci-fi lighting */}
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#D97706" />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#3b82f6" />
        <spotLight position={[0, 10, 0]} intensity={2} angle={0.6} penumbra={1} color="#ffffff" castShadow />
        
        {/* Central Holographic Table Placeholder */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[1.5, 1.6, 0.2, 32]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
        </mesh>
        
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[1.4, 1.4, 0.05, 32]} />
          <meshStandardMaterial color="#D97706" emissive="#D97706" emissiveIntensity={0.5} wireframe />
        </mesh>

        {/* Floor Grid */}
        <Grid 
          infiniteGrid 
          fadeDistance={25} 
          sectionColor="#D97706" 
          cellColor="#3d3d3d" 
          position={[0, -0.01, 0]} 
        />
        
        {/* Contact Shadows for realism */}
        <ContactShadows position={[0, 0, 0]} scale={20} blur={2} far={4.5} opacity={0.5} />

        {/* Render Agents */}
        {AGENTS_DATA.map((agent, index) => (
          <AgentAvatar key={agent.id} agent={agent} position={positions[index]} />
        ))}

        <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going below ground
          minDistance={2}
          maxDistance={20}
          target={[0, 1, 0]}
        />
      </Canvas>
    </div>
  );
}
