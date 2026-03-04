import React, { useMemo } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import './BlochSphere.css';

// Renders ONE sphere.
// `blochVector` — { x, y, z, length } from the state-vector engine.
//   length = 1  → pure state (arrow on sphere surface, bright yellow)
//   length ≈ 0  → maximally mixed / entangled (very short arrow, desaturated)
// Falls back to the quaternion `rotation` when `blochVector` is absent.
function SingleQubit({ rotation, blochVector, position, label, isSelected, onClick }) {
  const { direction, arrowLength, arrowColor } = useMemo(() => {
    if (blochVector) {
      const raw = new THREE.Vector3(blochVector.x, blochVector.y, blochVector.z);
      const purity = blochVector.length; // [0, 1]

      // Keep arrow pointing in the right direction even for mixed states;
      // use the raw length so it visually shrinks toward the origin.
      const dir = raw.lengthSq() > 1e-8 ? raw.clone().normalize() : new THREE.Vector3(0, 1, 0);
      const len = Math.max(0.05, purity); // never fully vanish

      // Colour: bright yellow for pure, desaturated grey-yellow for mixed
      const bright = Math.round(255 * purity);
      const dim    = Math.round(128 * (1 - purity));
      const color  = (bright << 16) | (bright << 8) | dim; // rgb(p,p,dim)

      return { direction: dir, arrowLength: len, arrowColor: color };
    }

    // Legacy quaternion path (manual rotation, no circuit gates applied)
    const base = new THREE.Vector3(0, 1, 0);
    return {
      direction:   base.applyQuaternion(rotation),
      arrowLength: 1,
      arrowColor:  0xffff00,
    };
  }, [rotation, blochVector]);

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
      <axesHelper args={[1]} />
      <axesHelper args={[-1]} />
      <arrowHelper args={[direction, new THREE.Vector3(0, 0, 0), arrowLength, arrowColor]} />

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
export default function BlochSphere({ qubits, selected, highlightedIds, onSelect }) {
  return (
    <div className="bloch-container">
      <Canvas camera={{ position: [0, 2, 8] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        {qubits.map((qubit) => (
          <SingleQubit
            key={qubit.id}
            rotation={qubit.rotation}
            blochVector={qubit.blochVector}
            position={qubit.position}
            label={qubit.name}
            isSelected={highlightedIds.has(qubit.id)}
            onClick={() => onSelect({ type: 'qubit', id: qubit.id })}
          />
        ))}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}