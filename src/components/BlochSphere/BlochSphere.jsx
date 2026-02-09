import React, { useMemo } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import './BlochSphere.css';

// Renders ONE sphere.
function SingleQubit({ rotation, position, label, isSelected, onClick }) {
  const direction = useMemo(() => {
    const base = new THREE.Vector3(0, 1, 0);
    return base.applyQuaternion(rotation);
  }, [rotation]);

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      
      {/* Selection Highlight Ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.15, 32]} />
          <meshBasicMaterial color="#646cff" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* The Transparent Sphere */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
          color={isSelected ? "#007bff" : "#444"} 
          wireframe 
          transparent 
          opacity={0.3} 
        />
      </mesh>

      {/* Axes & Arrow */}
      <axesHelper args={[1.2]} />
      <axesHelper args={[-1.2]} />
      <arrowHelper args={[direction, new THREE.Vector3(0, 0, 0), 1, 0xffff00]} />

      {/* Labels */}
      <Html position={[0, -1.5, 0]} center>
        <div className="label" style={{ 
          color: isSelected ? '#646cff' : 'white', 
          fontWeight: isSelected ? 'bold' : 'normal',
          whiteSpace: 'nowrap'
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// Main Component
export default function BlochSphere({ qubits, selectedId, onSelect }) {
  return (
    <div className="bloch-container">
      <Canvas camera={{ position: [0, 2, 8] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        
        {qubits.map((qubit) => (
          <SingleQubit
            key={qubit.id}
            rotation={qubit.rotation}
            position={qubit.position} // Reads [x,y,z] from state
            label={qubit.name}
            isSelected={selectedId === qubit.id}
            onClick={() => onSelect(qubit.id)}
          />
        ))}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}