import { useState } from 'react';
import BlochSphere from "./components/BlochSphere";
import SideMenu from './components/SideMenu';
import './App.css';
import * as THREE from 'three';

function App() {
  const [rotation, setRotation] = useState(new THREE.Quaternion());
  // --- ADD NEW STATE ---
  const [showTrail, setShowTrail] = useState(true); // Trail is on by default
  // --- END ADD ---

  return (
    <div className="App">
      {/* Pass the new state and setter to SideMenu */}
      <SideMenu 
        rotation={rotation} 
        setRotation={setRotation} 
        showTrail={showTrail}
        setShowTrail={setShowTrail}
      />
      
      <div className="canvas-container">
        {/* Pass the showTrail state to BlochSphere */}
        <BlochSphere rotation={rotation} showTrail={showTrail} />
      </div>
    </div>
  );
}

export default App;