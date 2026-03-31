import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Renders a glowing tube between two entangled qubits.
 * The tube starts and ends at the sphere surface (radius 1),
 * with a slight arc so it reads as a connection rather than
 * a clipped straight line through the sphere shells.
 */
function EntanglementTube({ posA, posB, purityA, purityB }) {
  const meshRef = useRef();

  const entanglementStrength = 1 - Math.min(purityA, purityB);

  const tubeGeometry = useMemo(() => {
    const vA = new THREE.Vector3(...posA);
    const vB = new THREE.Vector3(...posB);

    const dir = new THREE.Vector3().subVectors(vB, vA).normalize();

    // Start and end at each sphere's surface (radius = 1)
    const surfaceStart = vA.clone().addScaledVector(dir,  1.0);
    const surfaceEnd   = vB.clone().addScaledVector(dir, -1.0);

    // Midpoint with a gentle perpendicular arc
    const mid = new THREE.Vector3()
      .addVectors(surfaceStart, surfaceEnd)
      .multiplyScalar(0.5);
    const perp = new THREE.Vector3(dir.y, -dir.x, dir.z).normalize();
    mid.addScaledVector(perp, 0.15);

    const path = new THREE.CatmullRomCurve3([surfaceStart, mid, surfaceEnd]);
    return new THREE.TubeGeometry(path, 20, 0.04, 8, false);
  }, [posA, posB]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.5);
      meshRef.current.material.emissiveIntensity = pulse * entanglementStrength;
    }
  });

  return (
    <mesh ref={meshRef} geometry={tubeGeometry}>
      <meshStandardMaterial
        color="#ff6600"
        emissive="#ff3300"
        emissiveIntensity={0.8}
        roughness={0.2}
        metalness={0.4}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

/**
 * Finds all entangled pairs and renders tubes between them.
 */
export default function EntanglementLinks({ qubits }) {
  const entangledPairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < qubits.length; i++) {
      for (let j = i + 1; j < qubits.length; j++) {
        const pA = qubits[i].blochData?.purity ?? 1;
        const pB = qubits[j].blochData?.purity ?? 1;
        if (pA < 0.99 && pB < 0.99) {
          pairs.push({ i, j, purityA: pA, purityB: pB });
        }
      }
    }
    return pairs;
  }, [qubits]);

  if (entangledPairs.length === 0) return null;

  return (
    <>
      {entangledPairs.map(({ i, j, purityA, purityB }) => (
        <EntanglementTube
          key={`${qubits[i].id}-${qubits[j].id}`}
          posA={qubits[i].position}
          posB={qubits[j].position}
          purityA={purityA}
          purityB={purityB}
        />
      ))}
    </>
  );
}