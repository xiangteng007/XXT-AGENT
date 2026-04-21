"use client";

import React, { Suspense, Component, ErrorInfo, ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { GroupProps } from "@react-three/fiber";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Failed to load 3D model:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface ModelProps extends GroupProps {
  url: string;
}

function Model({ url, ...props }: ModelProps) {
  const { scene } = useGLTF(url);
  // Center the model and adjust its scale if needed
  // We clone the scene so multiple instances don't share the exact same object reference
  return <primitive object={scene.clone()} {...props} />;
}

// Preload is typically good, but since files might be missing dynamically, we won't strictly preload all.
// useGLTF.preload('/models/nova.glb');

interface DynamicModelProps extends GroupProps {
  modelName: string;
  fallbackColor?: string;
}

/**
 * DynamicModel component that attempts to load a generated .glb file from public/models.
 * If the file is not found or fails to load, it falls back to a placeholder wireframe.
 */
export function DynamicModel({ modelName, fallbackColor = "#00f0ff", ...props }: DynamicModelProps) {
  const modelUrl = `/models/${modelName.toLowerCase()}.glb`;

  return (
    <ErrorBoundary
      fallback={
        <group {...props}>
          {/* Default Wireframe Placeholder if model fails to load or isn't generated yet */}
          <mesh>
            <cylinderGeometry args={[0.5, 0.5, 2, 8]} />
            <meshBasicMaterial color={fallbackColor} wireframe />
          </mesh>
        </group>
      }
    >
      <Suspense
        fallback={
          <group {...props}>
            <mesh>
              <cylinderGeometry args={[0.5, 0.5, 2, 8]} />
              <meshBasicMaterial color="#ffff00" wireframe />
            </mesh>
          </group>
        }
      >
        <Model url={modelUrl} {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
