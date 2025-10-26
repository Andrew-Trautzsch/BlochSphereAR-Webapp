import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Html } from '@react-three/drei';
import * as THREE from "three";

function Sphere() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#007bff" wireframe />
    </mesh>
  );
}

function BlochElements() {
  return (
    <>
      {/* Axes */}
      <axesHelper args={[1]} />
      <axesHelper args={[-1]} />

      {/* State vector (arrow) */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 0), // direction (45° between X and Y)
          new THREE.Vector3(0, 0, 0),     // origin
          1,                              // length
          0xffff00                        // color (red)
        ]}
      />

      {/* Polar labels */}
      <Html position={[0, 1.2, 0]} center>
        <div style={{ color: 'white', fontSize: '1rem' }}>|0⟩</div>
      </Html>
      <Html position={[0, -1.2, 0]} center>
        <div style={{ color: 'white', fontSize: '1rem' }}>|1⟩</div>
      </Html>
    </>
  );
}


export default function BlochSphere() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <Sphere />
      <BlochElements />
      <OrbitControls enableZoom={true} />
    </Canvas>
  );
}