import React, { useState } from 'react';
import * as THREE from 'three';

// Helpers
const degToRad = (deg) => (deg * Math.PI) / 180;

export default function CustomRotationMenu({ rotation, setRotation }) {
  const [axis, setAxis] = useState({ x: 0, y: 0, z: 1 });
  const [angleDeg, setAngleDeg] = useState(0);

  // This function updates the inputs AND the global quaternion state
  const updateGlobalRotation = (newAxis, newAngleDeg) => {
    // 1. Normalize the axis vector
    const normAxis = new THREE.Vector3(newAxis.x, newAxis.y, newAxis.z);
    
    if (normAxis.lengthSq() === 0) {
      normAxis.set(0, 1, 0); // Default to Y-axis if input is (0,0,0)
    } else {
      normAxis.normalize();
    }

    // 2. Convert angle to radians
    const radAngle = degToRad(newAngleDeg);

    // 3. Create Quaternion and update global state
    setRotation(new THREE.Quaternion().setFromAxisAngle(normAxis, radAngle));
  };

  // Handle changes from axis inputs
  const handleAxisChange = (axisKey, value) => {
    const newAxis = { ...axis };
    newAxis[axisKey] = parseFloat(value) || 0;
    
    // Update local state
    setAxis(newAxis);
    // AND update global state immediately
    updateGlobalRotation(newAxis, angleDeg);
  };
  
  // Handle changes from angle slider
  const handleAngleChange = (value) => {
    const newAngleDeg = parseFloat(value);
    
    // Update local state
    setAngleDeg(newAngleDeg);
    // AND update global state immediately
    updateGlobalRotation(axis, newAngleDeg);
  };

  return (
    <div className="custom-rotation-menu">
      
      <p style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#ccc', marginTop: 0 }}>
        Define a 3D vector (an "axle") to rotate around.
        The length doesn't matter, only the direction.
      </p>
      
      <div className="input-group">
        <label>Axis Vector (X):</label>
        <input 
          type="number" 
          step="0.1" 
          value={axis.x.toFixed(2)}
          onChange={(e) => handleAxisChange('x', e.target.value)}
          // onBlur removed
        />
      </div>
      <div className="input-group">
        <label>Axis Vector (Y):</label>
        <input 
          type="number" 
          step="0.1" 
          value={axis.y.toFixed(2)}
          onChange={(e) => handleAxisChange('y', e.target.value)}
          // onBlur removed
        />
      </div>
      <div className="input-group">
        <label>Axis Vector (Z):</label>
        <input 
          type="number" 
          step="0.1" 
          value={axis.z.toFixed(2)}
          onChange={(e) => handleAxisChange('z', e.target.value)}
          // onBlur removed
        />
      </div>
      
      <div className="slider-group">
        <label>Angle: {angleDeg.toFixed(0)}°</label>
        <input
          type="range"
          min="0"
          max="360"
          step="1"
          value={angleDeg}
          onChange={(e) => handleAngleChange(e.target.value)}
          // onMouseUp and onTouchEnd removed
        />
      </div>
    </div>
  );
}