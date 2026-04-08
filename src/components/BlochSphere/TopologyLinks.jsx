import React, { useMemo } from 'react';
import * as THREE from 'three';

const TUBE_RADIUS   = 0.04;
const TUBE_SEGMENTS = 6;
const TUBE_COLOR    = '#2255aa';
const TUBE_OPACITY  = 0.45;

function TopologyTube({ posA, posB }) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...posA);
    const b = new THREE.Vector3(...posB);
    if (a.distanceTo(b) < 1e-6) return null;
    const curve = new THREE.LineCurve3(a, b);
    return new THREE.TubeGeometry(curve, 1, TUBE_RADIUS, TUBE_SEGMENTS, false);
  }, [posA, posB]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={TUBE_COLOR}
        emissive={TUBE_COLOR}
        emissiveIntensity={0.4}
        transparent
        opacity={TUBE_OPACITY}
        depthWrite={false}
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
}

export default function TopologyLinks({ qubits, edges }) {
  const qubitMap = useMemo(() => {
    const m = {};
    qubits.forEach(q => { m[q.id] = q.position; });
    return m;
  }, [qubits]);

  if (!edges || edges.length === 0) return null;

  return (
    <>
      {edges.map(([aId, bId], i) => {
        const posA = qubitMap[aId];
        const posB = qubitMap[bId];
        if (!posA || !posB) return null;
        return (
          <TopologyTube
            key={`topo-${i}-${aId}-${bId}`}
            posA={posA}
            posB={posB}
          />
        );
      })}
    </>
  );
}