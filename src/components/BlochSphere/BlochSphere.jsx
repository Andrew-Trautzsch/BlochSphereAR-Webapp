import React, { useMemo } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import EntanglementLinks from './EntanglementLinks';
import './BlochSphere.css';

// Human-readable labels for internal gate token names
const GATE_DISPLAY = {
  H:     'H',
  X:     'X',
  Y:     'Y',
  Z:     'Z',
  S:     'S',
  T:     'T',
  S_DAG: 'S†',
  T_DAG: 'T†',
  C:     '●',    // CNOT control
  TG:    '⊕',    // CNOT target
  CZC:   'CZ',   // CZ control
  CZT:   'CZ',   // CZ target
  SWA:   '×',    // SWAP
  SWB:   '×',    // SWAP
};

/**
 * A small dot sitting at a pole with a "0" or "1" label inside.
 */
function PoleDot({ position, label, color, glowColor, opacity }) {
  return (
    <group position={position}>
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

/**
 * Gate label pill rendered at dead center of the sphere.
 * Uses an Html overlay with a semi-transparent dark pill background
 * so the arrow always renders on top via Three.js z-ordering.
 */
function GatePill({ gateName }) {
  if (!gateName) return null;
  const display = GATE_DISPLAY[gateName] ?? gateName;

  return (
    <Html position={[0, 0, 0]} center zIndexRange={[0, 0]}>
      <div style={{
        background: 'rgba(10, 10, 20, 0.72)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: '5px',
        padding: '2px 6px',
        color: 'white',
        fontSize: '11px',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        userSelect: 'none',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        letterSpacing: '0.03em',
      }}>
        {display}
      </div>
    </Html>
  );
}

function SingleQubit({ rotation, blochData, position, label, isSelected, onClick, currentGate }) {
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

  const bz = direction.y;
  const t  = (bz + 1) / 2;
  const sphereColor = new THREE.Color().lerpColors(
    new THREE.Color(0x00cc44),
    new THREE.Color(0xcc2200),
    t
  );

  const p0 = Math.max(0.45, (bz + 1) / 2);
  const p1 = Math.max(0.45, (1 - bz) / 2);

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>

      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.15, 32]} />
          <meshBasicMaterial color="#646cff" side={THREE.DoubleSide} />
        </mesh>
      )}

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

      <mesh>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? "#4488ff" : "#555"}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Gate pill renders before axes+arrow so arrow draws on top */}
      <GatePill gateName={currentGate} />

      <axesHelper args={[1]} />

      {/* Arrow renders last — always on top of the pill */}
      <arrowHelper args={[direction, new THREE.Vector3(0, 0, 0), 1, arrowColor]} />

      <PoleDot position={[0, 1.1, 0]}  label="0" color="#cc2200" glowColor="#ff4422" opacity={p0} />
      <PoleDot position={[0, -1.1, 0]} label="1" color="#00cc44" glowColor="#00ff55" opacity={p1} />

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

export default function BlochSphere({ qubits, selected, highlightedIds, onSelect, circuit, currentStep }) {
  return (
    <div className="bloch-container">
      <Canvas camera={{ position: [0, 2, 8] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <EntanglementLinks qubits={qubits} />

        {qubits.map((qubit) => {
          // currentStep is 1-based; circuit columns are 0-based
          const currentGate = currentStep > 0
            ? (circuit[qubit.id]?.[currentStep - 1] ?? null)
            : null;

          return (
            <SingleQubit
              key={qubit.id}
              rotation={qubit.rotation}
              blochData={qubit.blochData}
              position={qubit.position}
              label={qubit.name}
              isSelected={highlightedIds.has(qubit.id)}
              onClick={() => onSelect({ type: 'qubit', id: qubit.id })}
              currentGate={currentGate}
            />
          );
        })}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}