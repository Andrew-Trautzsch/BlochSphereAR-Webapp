import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import EntanglementLinks from './EntanglementLinks';
import './BlochSphere.css';

const TRAIL_STEPS      = 5;
const SLERP_SEGMENTS   = 24;
const TRAIL_COLOR      = '#00cfff';
const TRAIL_OPACITY    = 0.7;
const TRAIL_RADIUS     = 0.018;
// How long (ms) a direction must be stable before it's committed to history.
// Discrete gate clicks stabilize instantly; slider drags settle after this delay.
const SETTLE_DELAY_MS  = 120;

const GATE_DISPLAY = {
  H: 'H', X: 'X', Y: 'Y', Z: 'Z', S: 'S', T: 'T',
  S_DAG: 'S†', T_DAG: 'T†',
  C: '●', TG: '⊕',
  CZC: 'CZ', CZT: 'CZ',
  SWA: '×', SWB: '×',
};

function slerpArc(from, to, segments) {
  if (from.distanceTo(to) < 1e-6) return [from.clone()];
  const points = [];
  for (let i = 0; i <= segments; i++) {
    points.push(new THREE.Vector3().copy(from).lerp(to, i / segments).normalize());
  }
  return points;
}

// ---------------------------------------------------------------------------
// ArrowTrail
// ---------------------------------------------------------------------------
function ArrowTrail({ trailDirs }) {
  const geometry = useMemo(() => {
    if (trailDirs.length < 2) return null;

    const allPoints = [];
    for (let i = 0; i < trailDirs.length - 1; i++) {
      const seg = slerpArc(trailDirs[i], trailDirs[i + 1], SLERP_SEGMENTS);
      if (i > 0) seg.shift();
      allPoints.push(...seg);
    }
    if (allPoints.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(allPoints);
    return new THREE.TubeGeometry(curve, allPoints.length * 2, TRAIL_RADIUS, 6, false);
  }, [trailDirs]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={TRAIL_COLOR}
        emissive={TRAIL_COLOR}
        emissiveIntensity={0.6}
        transparent
        opacity={TRAIL_OPACITY}
        depthWrite={false}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// PoleDot
// ---------------------------------------------------------------------------
function PoleDot({ position, label, color, glowColor, opacity }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial
          color={glowColor} emissive={glowColor}
          emissiveIntensity={opacity * 1.5}
          transparent opacity={opacity * 0.4} depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial
          color={color} emissive={color}
          emissiveIntensity={opacity}
          transparent opacity={opacity} depthWrite={false}
        />
      </mesh>
      <Html center>
        <div style={{
          color: 'white', fontSize: '9px', fontWeight: 'bold',
          fontFamily: 'monospace', userSelect: 'none', pointerEvents: 'none',
          opacity, textShadow: `0 0 4px ${color}`, lineHeight: 1,
        }}>{label}</div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------------------
// GatePill
// ---------------------------------------------------------------------------
function GatePill({ gateName }) {
  if (!gateName) return null;
  const display = GATE_DISPLAY[gateName] ?? gateName;
  return (
    <Html position={[0, 0, 0]} center zIndexRange={[0, 0]}>
      <div style={{
        background: 'rgba(10,10,20,0.72)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: '5px', padding: '2px 6px',
        color: 'white', fontSize: '11px', fontWeight: 'bold',
        fontFamily: 'monospace', userSelect: 'none', pointerEvents: 'none',
        whiteSpace: 'nowrap', letterSpacing: '0.03em',
      }}>{display}</div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// SingleQubit
// ---------------------------------------------------------------------------
function SingleQubit({ rotation, blochData, position, label, isSelected, onClick, currentGate }) {
  const { direction, purity } = useMemo(() => {
    if (blochData) return blochData;
    return { direction: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation), purity: 1 };
  }, [rotation, blochData]);

  // trailRef holds committed history: Vector3[] oldest → newest.
  // Initialised with the current direction so the trail starts immediately
  // on first render with no delay.
  const trailRef    = useRef(null);
  const pendingRef  = useRef(null); // { dir, timestamp }
  const timerRef    = useRef(null);

  // Initialise history on first render
  if (trailRef.current === null) {
    trailRef.current = [direction.clone()];
  }

  // Force a re-render when the trail commits, without React state on every frame
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  useEffect(() => {
    const last = trailRef.current[trailRef.current.length - 1];

    // No meaningful movement — nothing to do
    if (direction.distanceTo(last) < 1e-4) return;

    // Cancel any previously scheduled commit
    if (timerRef.current) clearTimeout(timerRef.current);

    // Record the incoming direction as pending
    pendingRef.current = direction.clone();

    // Commit after the settle delay
    timerRef.current = setTimeout(() => {
      const stillLast = trailRef.current[trailRef.current.current - 1];
      trailRef.current = [
        ...trailRef.current.slice(-TRAIL_STEPS),
        pendingRef.current,
      ];
      pendingRef.current = null;
      forceUpdate();
    }, SETTLE_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [direction]);

  const trailDirs = trailRef.current;

  const isEntangled = purity < 0.99;
  const arrowColor = isSelected
    ? (isEntangled ? 0xff6600 : 0xffa500)
    : (isEntangled ? 0xff6600 : 0xffff00);

  const bz = direction.y;
  const sphereColor = new THREE.Color().lerpColors(
    new THREE.Color(0x00cc44), new THREE.Color(0xcc2200), (bz + 1) / 2
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
          transparent opacity={0.18} roughness={0.4} metalness={0.1}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? "#4488ff" : "#555"}
          wireframe transparent opacity={0.25}
        />
      </mesh>

      <ArrowTrail trailDirs={trailDirs} />
      <GatePill gateName={currentGate} />
      <axesHelper args={[1]} />
      <axesHelper args={[-1]} />
      <arrowHelper args={[direction, new THREE.Vector3(0, 0, 0), 1, arrowColor]} />

      <PoleDot position={[0,  1.1, 0]} label="0" color="#dfa093" glowColor="#ff4422" opacity={p0} />
      <PoleDot position={[0, -1.1, 0]} label="1" color="#00cc44" glowColor="#00ff55" opacity={p1} />

      <Html position={[0, -1.6, 0]} center>
        <div className="label" style={{
          color: isSelected ? '#646cff' : 'white',
          fontWeight: isSelected ? 'bold' : 'normal',
          whiteSpace: 'nowrap',
        }}>
          {label}
          {isEntangled && (
            <span style={{ fontSize: '0.7em', color: '#ff6600', marginLeft: 4 }}>⟨entangled⟩</span>
          )}
        </div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------------------
// BlochSphere
// ---------------------------------------------------------------------------
export default function BlochSphere({ qubits, selected, highlightedIds, onSelect, circuit, currentStep }) {
  return (
    <div className="bloch-container">
      <Canvas camera={{ position: [0, 2, 8] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <EntanglementLinks qubits={qubits} />

        {qubits.map((qubit) => {
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