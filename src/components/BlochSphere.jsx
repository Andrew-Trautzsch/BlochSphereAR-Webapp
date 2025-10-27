import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from 'react';

function Sphere() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#007bff" wireframe />
    </mesh>
  );
}

function BlochElements({ rotation }) {
  const direction = useMemo(() => {
    // --- FIX 1: Set base vector to Y-axis ---
    const base = new THREE.Vector3(0, 1, 0); 
    // --- END FIX 1 ---
    
    // Apply the quaternion rotation directly to the base vector
    return base.applyQuaternion(rotation);

  }, [rotation]);

  return (
    <>
      {/* Axes */}
      <axesHelper args={[1]} />
      <axesHelper args={[-1]} />

      {/* State vector (arrow) */}
      <arrowHelper
        args={[
          direction,
          new THREE.Vector3(0, 0, 0),
          1,
          0xffff00
        ]}
      />

      {/* --- FIX 2: Move Labels to Y-Axis --- */}
      <Html position={[0, 1.2, 0]} center> 
        <div style={{ color: 'white', fontSize: '1rem' }}>|0⟩</div>
      </Html>
      <Html position={[0, -1.2, 0]} center>
        <div style={{ color: 'white', fontSize: '1rem' }}>|1⟩</div>
      </Html>
      {/* --- END FIX 2 --- */}
    </>
  );
}

export default function BlochSphere({ rotation }) {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <Sphere />
      <BlochElements rotation={rotation} />
      <OrbitControls enableZoom={true} />
    </Canvas>
  );
}