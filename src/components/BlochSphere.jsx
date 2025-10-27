import { Canvas, useFrame } from "@react-three/fiber"; // 1. Import useFrame
import { OrbitControls, Html, Trail } from "@react-three/drei"; // 2. Import Trail
import * as THREE from "three";
import { useMemo, useRef } from 'react'; // 3. THIS IS THE FIX

function Sphere() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#007bff" wireframe />
    </mesh>
  );
}

// Receive new showTrail prop
function BlochElements({ rotation, showTrail }) {
  // 4. Create a ref for our invisible target
  const targetRef = useRef();

  const direction = useMemo(() => {
    const base = new THREE.Vector3(0, 1, 0); 
    return base.applyQuaternion(rotation);
  }, [rotation]);

  // 5. On every frame, update the invisible target's position
  useFrame(() => {
    if (targetRef.current) {
      targetRef.current.position.copy(direction);
    }
  });

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

      {/* Polar labels */}
      <Html position={[0, 1.2, 0]} center> 
        <div style={{ color: 'white', fontSize: '1rem' }}>|0⟩</div>
      </Html>
      <Html position={[0, -1.2, 0]} center>
        <div style={{ color: 'white', fontSize: '1rem' }}>|1⟩</div>
      </Html>
      
      {/* --- ADD TRAIL LOGIC --- */}
      
      {/* 6. This is the invisible mesh the trail will follow */}
      <mesh ref={targetRef} position={[0, 1, 0]}>
        <sphereGeometry args={[0.01]} /> {/* Tiny, invisible */}
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* 7. Conditionally render the Trail component */}
      {showTrail && (
        <Trail
          width={5} // Line width
          color={"#ffff00"} // Match arrow color
          length={80} // How long the trail is (frames)
          decay={1.2} // How fast it fades
          target={targetRef} // Point it at our invisible mesh
        />
      )}
      {/* --- END TRAIL LOGIC --- */}
    </>
  );
}

// Receive and pass down the new prop
export default function BlochSphere({ rotation, showTrail }) {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <Sphere />
      {/* Pass prop down to BlochElements */}
      <BlochElements rotation={rotation} showTrail={showTrail} />
      <OrbitControls enableZoom={true} />
    </Canvas>
  );
}