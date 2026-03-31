import React, { useMemo } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import EntanglementLinks from './EntanglementLinks';
import './BlochSphere.css';

/**
 * A small dot sitting at a pole with a "0" or "1" label inside.
 * opacity is driven by the probability of that state (0.15 min so it's
 * always at least faintly visible).
 */
function PoleDot({ position, label, color, glowColor, opacity }) {
  return (
    <group position={position}>
      {/* Outer glow ring */}
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={opacity * 1.5}
          transparent
          opacity={opacity * 0.4}
          depthWrite={false}
        />
      </mesh>
      {/* Solid dot */}
      <mesh>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={opacity}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      {/* Label rendered via Html so it always faces camera */}
      <Html center>
        <div style={{
          color: 'white',
          fontSize: '9px',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          userSelect: 'none',
          pointerEvents: 'none',
          opacity,
          textShadow: `0 0 4px ${color}`,
          lineHeight: 1,
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function SingleQubit({ rotation, blochData, position, label, isSelected, onClick }) {
  const { direction, purity } = useMemo(() => {
    if (blochData) return blochData;
    return {
      direction: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation),
      purity: 1,
    };
  }, [rotation, blochData]);

  const isEntangled = purity < 0.99;
  const arrowColor  = isSelected
    ? (isEntangled ? 0xff6600 : 0xffa500)
    : (isEntangled ? 0xff6600 : 0xffff00);

  // direction.y is the quantum Z axis (THREE.js Y = Bloch Z = |0⟩ pole).
  const bz = direction.y;
  const t  = (bz + 1) / 2;
  const sphereColor = new THREE.Color().lerpColors(
    new THREE.Color(0x00cc44),
    new THREE.Color(0xcc2200),
    t
  );

  // Probabilities for pole dot brightness.
  // Floor of 0.45 ensures the inactive dot is always clearly visible.
  const p0 = Math.max(0.45, (bz + 1) / 2);   // |0⟩ — top pole
  const p1 = Math.max(0.45, (1 - bz) / 2);   // |1⟩ — bottom pole

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>

      {/* Selection highlight ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.15, 32]} />
          <meshBasicMaterial color="#646cff" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Solid translucent state-color sphere */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={isSelected ? sphereColor.clone().lerp(new THREE.Color(0x4488ff), 0.35) : sphereColor}
          transparent
          opacity={0.18}
          roughness={0.4}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Wireframe overlay */}
      <mesh>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? "#4488ff" : "#555"}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Axis guides */}
      <axesHelper args={[1]} />

      {/* State arrow */}
      <arrowHelper args={[direction, new THREE.Vector3(0, 0, 0), 1, arrowColor]} />

      {/* |0⟩ pole dot — top. Brightness = probability of measuring |0⟩. */}
      <PoleDot
        position={[0, 1.1, 0]}
        label="|0⟩"
        color="#cc2200"
        glowColor="#ff4422"
        opacity={p0}
      />

      {/* |1⟩ pole dot — bottom. Brightness = probability of measuring |1⟩. */}
      <PoleDot
        position={[0, -1.1, 0]}
        label="|1⟩"
        color="#00cc44"
        glowColor="#00ff55"
        opacity={p1}
      />

      {/* Qubit label */}
      <Html position={[0, -1.6, 0]} center>
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

        <EntanglementLinks qubits={qubits} />

        {qubits.map((qubit) => (
          <SingleQubit
            key={qubit.id}
            rotation={qubit.rotation}
            blochData={qubit.blochData}
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