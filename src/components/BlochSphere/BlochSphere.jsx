import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import EntanglementLinks from './EntanglementLinks';
import TopologyLinks from './TopologyLinks';
import './BlochSphere.css';

const TRAIL_STEPS     = 5;
const SLERP_SEGMENTS  = 24;
const TRAIL_COLOR     = '#00cfff';
const TRAIL_OPACITY   = 0.7;
const TRAIL_RADIUS    = 0.018;
const SETTLE_DELAY_MS = 120;

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
        color={TRAIL_COLOR} emissive={TRAIL_COLOR} emissiveIntensity={0.6}
        transparent opacity={TRAIL_OPACITY} depthWrite={false} roughness={0.3} metalness={0.1}
      />
    </mesh>
  );
}

function PoleDot({ position, label, color, glowColor, opacity }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor}
          emissiveIntensity={opacity * 1.5} transparent opacity={opacity * 0.4} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color}
          emissiveIntensity={opacity} transparent opacity={opacity} depthWrite={false} />
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

function GatePill({ gateName }) {
  if (!gateName) return null;
  const display = GATE_DISPLAY[gateName] ?? gateName;
  return (
    <Html position={[0, 0, 0]} center zIndexRange={[0, 0]}>
      <div style={{
        background: 'rgba(10,10,20,0.72)', border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: '5px', padding: '2px 6px', color: 'white', fontSize: '11px',
        fontWeight: 'bold', fontFamily: 'monospace', userSelect: 'none',
        pointerEvents: 'none', whiteSpace: 'nowrap', letterSpacing: '0.03em',
      }}>{display}</div>
    </Html>
  );
}

// Animated dashed ring shown around the source qubit while connecting
function ConnectingRing() {
  const meshRef = useRef();
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 1.5;
    }
  });
  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.25, 1.32, 48]} />
      <meshBasicMaterial color="#00e5ff" side={THREE.DoubleSide} transparent opacity={0.7} />
    </mesh>
  );
}

function SingleQubit({
  rotation, blochData, position, label,
  isSelected, isConnectSource, isConnectMode,
  onClick, currentGate, measured, measurementOutcome,
}) {
  const { direction, purity } = useMemo(() => {
    if (blochData) return blochData;
    return { direction: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation), purity: 1 };
  }, [rotation, blochData]);

  const trailRef   = useRef(null);
  const pendingRef = useRef(null);
  const timerRef   = useRef(null);

  if (trailRef.current === null) trailRef.current = [direction.clone()];

  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  useEffect(() => {
    const last = trailRef.current[trailRef.current.length - 1];
    if (direction.distanceTo(last) < 1e-4) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = direction.clone();
    timerRef.current = setTimeout(() => {
      trailRef.current = [...trailRef.current.slice(-TRAIL_STEPS), pendingRef.current];
      pendingRef.current = null;
      forceUpdate();
    }, SETTLE_DELAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [direction]);

  const isEntangled = purity < 0.99;
  const arrowColor  = isSelected
    ? (isEntangled ? 0xff6600 : 0xffa500)
    : (isEntangled ? 0xff6600 : 0xffff00);

  const bz = direction.y;
  const sphereColor = new THREE.Color().lerpColors(
    new THREE.Color(0x00cc44), new THREE.Color(0xcc2200), (bz + 1) / 2
  );

  // In connect mode, non-source qubits get a subtle teal tint to show they're clickable targets
  const displayColor = isConnectSource
    ? sphereColor.clone().lerp(new THREE.Color(0x00e5ff), 0.5)
    : isConnectMode && !isConnectSource
    ? sphereColor.clone().lerp(new THREE.Color(0x004466), 0.3)
    : isSelected
    ? sphereColor.clone().lerp(new THREE.Color(0x4488ff), 0.35)
    : sphereColor;

  const p0 = Math.max(0.45, (bz + 1) / 2);
  const p1 = Math.max(0.45, (1 - bz) / 2);

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(e); }}>
      {isSelected && !isConnectMode && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.15, 32]} />
          <meshBasicMaterial color="#646cff" side={THREE.DoubleSide} />
        </mesh>
      )}
      {isConnectSource && <ConnectingRing />}

      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={displayColor} transparent opacity={0.18}
          roughness={0.4} metalness={0.1} side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={isConnectSource ? "#00e5ff" : isSelected ? "#4488ff" : "#555"}
          wireframe transparent opacity={isConnectMode ? 0.35 : 0.25}
        />
      </mesh>
      <ArrowTrail trailDirs={trailRef.current} />
      <GatePill gateName={currentGate} />

      {/* Measurement outcome indicator */}
      {measured && (
        <Html position={[0, 1.9, 0]} center zIndexRange={[10, 10]}>
          <div style={{
            background: measurementOutcome === 0 ? 'rgba(10,20,50,0.85)' : 'rgba(50,10,10,0.85)',
            border: `1px solid ${measurementOutcome === 0 ? '#2255aa' : '#aa2222'}`,
            borderRadius: '5px', padding: '2px 8px',
            color: measurementOutcome === 0 ? '#7ab3ff' : '#ff7a7a',
            fontSize: '12px', fontWeight: 'bold',
            fontFamily: 'monospace', userSelect: 'none', pointerEvents: 'none',
            whiteSpace: 'nowrap', letterSpacing: '0.05em',
          }}>
            {measurementOutcome === 0 ? '|0⟩' : '|1⟩'}
          </div>
        </Html>
      )}
      <axesHelper args={[1]} />
      <axesHelper args={[-1]} />
      <arrowHelper args={[direction, new THREE.Vector3(0, 0, 0), 1, arrowColor]} />
      <PoleDot position={[0,  1.1, 0]} label="0" color="#dfa093" glowColor="#ff4422" opacity={p0} />
      <PoleDot position={[0, -1.1, 0]} label="1" color="#00cc44" glowColor="#00ff55" opacity={p1} />
      <Html position={[0, -1.6, 0]} center>
        <div className="label" style={{
          color: isConnectSource ? '#00e5ff' : isSelected ? '#646cff' : 'white',
          fontWeight: (isSelected || isConnectSource) ? 'bold' : 'normal',
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

// Inner scene component so we can access useThree for cursor control
function Scene({ qubits, selected, highlightedIds, onSelect, circuit, currentStep, edges, onAddSimEdge }) {
  const { gl } = useThree();
  const [connectingFrom, setConnectingFrom] = useState(null); // qubitId | null
  const isConnectMode = connectingFrom !== null;

  // Update canvas cursor based on connect mode
  useEffect(() => {
    gl.domElement.style.cursor = isConnectMode ? 'crosshair' : 'default';
    return () => { gl.domElement.style.cursor = 'default'; };
  }, [isConnectMode, gl]);

  // Cancel connect on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setConnectingFrom(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleQubitClick = useCallback((e, qubitId) => {
    const shiftHeld = e.nativeEvent?.shiftKey ?? false;

    if (shiftHeld || isConnectMode) {
      e.stopPropagation();
      if (!connectingFrom) {
        // Start connection
        setConnectingFrom(qubitId);
      } else if (connectingFrom === qubitId) {
        // Clicked same qubit — cancel
        setConnectingFrom(null);
      } else {
        // Complete the edge
        onAddSimEdge(connectingFrom, qubitId);
        setConnectingFrom(null);
      }
      return;
    }

    // Normal select
    onSelect({ type: 'qubit', id: qubitId });
  }, [connectingFrom, isConnectMode, onAddSimEdge, onSelect]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />

      <TopologyLinks qubits={qubits} edges={edges} />
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
            isConnectSource={connectingFrom === qubit.id}
            isConnectMode={isConnectMode}
            onClick={(e) => handleQubitClick(e, qubit.id)}
            currentGate={currentGate}
            measured={qubit.blochData?.measured ?? false}
            measurementOutcome={qubit.blochData?.measurementOutcome ?? null}
          />
        );
      })}

      <OrbitControls makeDefault enabled={!isConnectMode} />
    </>
  );
}

export default function BlochSphere({
  qubits, selected, highlightedIds, onSelect,
  circuit, currentStep, edges, onAddSimEdge,
}) {
  return (
    <div className="bloch-container">
      {/* Connect mode hint overlay */}
      <div className="connect-hint">
        <span>⇧ Shift+click a qubit to start connecting · click another to link · Esc to cancel</span>
      </div>

      <Canvas camera={{ position: [0, 2, 8] }}>
        <Scene
          qubits={qubits}
          selected={selected}
          highlightedIds={highlightedIds}
          onSelect={onSelect}
          circuit={circuit}
          currentStep={currentStep}
          edges={edges}
          onAddSimEdge={onAddSimEdge}
        />
      </Canvas>
    </div>
  );
}