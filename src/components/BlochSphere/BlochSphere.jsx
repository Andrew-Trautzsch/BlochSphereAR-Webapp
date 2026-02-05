import React, { useMemo } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import './BlochSphere.css';

// Sub-component for the visual elements
function SceneContent({ rotation }) {
  const direction = useMemo(() => {
    // Base State |0> is along +Y in this visualization
    const base = new THREE.Vector3(0, 1, 0);
    return base.applyQuaternion(rotation);
  }, [rotation]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      
      {/* The Transparent Sphere */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
          color="#007bff" 
          wireframe 
          transparent 
          opacity={0.3} 
        />
      </mesh>

      {/* Coordinate Axes */}
      <axesHelper args={[1.2]} />
      <axesHelper args={[-1.2]} />

      {/* The State Vector Arrow */}
      <arrowHelper
        args={[direction, new THREE.Vector3(0, 0, 0), 1, 0xffff00]}
      />

      {/* Labels */}
      <Html position={[0, 1.2, 0]} center>
        <div className="label">|0⟩</div>
      </Html>
      <Html position={[0, -1.2, 0]} center>
        <div className="label">|1⟩</div>
      </Html>
    </>
  );
}

export default function BlochSphere({ rotation }) {
  return (
    <div className="bloch-container">
      <Canvas camera={{ position: [2, 1, 3] }}>
        <SceneContent rotation={rotation} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}