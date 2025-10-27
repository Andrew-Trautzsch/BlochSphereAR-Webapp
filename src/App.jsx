import { useState } from 'react';
import BlochSphere from "./components/BlochSphere";
import SideMenu from './components/SideMenu';
import './App.css';
import * as THREE from 'three'; // Import THREE

function App() {
  // --- CHANGE ---
  // State is now a Quaternion, representing the sphere's orientation
  const [rotation, setRotation] = useState(new THREE.Quaternion());
  // --- END CHANGE ---

  return (
    <div className="App">
      <SideMenu rotation={rotation} setRotation={setRotation} />
      
      <div className="canvas-container">
        <BlochSphere rotation={rotation} />
      </div>
    </div>
  );
}

export default App;