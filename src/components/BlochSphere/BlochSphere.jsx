import React, { useMemo } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import './BlochSphere.css';

function SingleQubit({ rotation, blochData, position, label, isSelected, onClick }) {
  // blochData = { direction: THREE.Vector3 (unit), purity: number 0–1 }
  // If blochData is not yet available (e.g. no simulation run yet), fall back
  // to reading the arrow directly from the quaternion — identical to the
  // original code and guaranteed to be unit length.
  const { direction, purity } = useMemo(() => {
    if (blochData) return blochData;

    // Fallback: original behaviour — rotate Y-up by the quaternion
    return {
      direction: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation),
      purity: 1,
    };
  }, [rotation, blochData]);

  // Arrow color: yellow (pure) → orange (mixed/entangled)
  // For most single-qubit / un-entangled use-cases purity stays at 1 and the
  // arrow is always yellow, exactly like before.
  const isEntangled = purity < 0.99;
  const arrowColor  = isSelected
    ? (isEntangled ? 0xff6600 : 0xffa500)
    : (isEntangled ? 0xff6600 : 0xffff00);

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>

      {/* Selection highlight ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.15, 32]} />
          <meshBasicMaterial color="#646cff" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Transparent wireframe sphere */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={isSelected ? "#007bff" : "#444"}
          wireframe transparent opacity={0.3}
        />
      </mesh>

      {/* Axis guides */}
      <axesHelper args={[1]} />

      {/* State arrow — always drawn at radius 1 so tip touches the sphere.
          purity only changes colour, not length, so un-entangled qubits look
          identical to the original implementation. */}
      <arrowHelper args={[direction, new THREE.Vector3(0, 0, 0), 1, arrowColor]} />

      {/* Qubit label */}
      <Html position={[0, -1.5, 0]} center>
        <div className="label" style={{
          color: isSelected ? '#646cff' : 'white',
          fontWeight: isSelected ? 'bold' : 'normal',
          whiteSpace: 'nowrap',
        }}>
          {label}
          {isEntangled && (
            <span style={{ fontSize: '0.7em', color: '#ff6600', marginLeft: 4 }}>
              ⟨entangled⟩
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

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
            blochData={qubit.blochData}   // { direction, purity } from simulation
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