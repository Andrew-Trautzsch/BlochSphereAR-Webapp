import { useState } from 'react';
import BlochSphere from "./components/BlochSphere";
import SideMenu from './components/SideMenu'; // Import the new component
import './App.css';

function App() {
  // State for rotation [x, y, z] in radians, lifted up from BlochSphere
  const [rotation, setRotation] = useState([0, 0, 0]);

  return (
    <div className="App">
      {/* SideMenu controls the state */}
      <SideMenu rotation={rotation} setRotation={setRotation} />
      
      {/* Canvas container takes the remaining space */}
      <div className="canvas-container">
        {/* BlochSphere displays the state */}
        <BlochSphere rotation={rotation} />
      </div>
    </div>
  );
}

export default App;