import { useState } from 'react';
import * as THREE from 'three';
import Sidebar from './components/Sidebar/Sidebar';
import BlochSphere from './components/BlochSphere/BlochSphere';
import './App.css';

function App() {
  // Central State: Rotation of the qubit
  // Future upgrade: Change this to an array of objects to support multiple spheres
  const [rotation, setRotation] = useState(new THREE.Quaternion());

  return (
    <div className="app-layout">
      {/* 1. Control Panel */}
      <Sidebar 
        rotation={rotation} 
        setRotation={setRotation} 
      />
      
      {/* 2. Visualization Area */}
      <main className="main-content">
        <BlochSphere rotation={rotation} />
      </main>
    </div>
  );
}

export default App;