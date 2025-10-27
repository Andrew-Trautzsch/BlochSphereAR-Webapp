import React, { useState } from 'react';
import * as THREE from 'three';

// Helpers
const degToRad = (deg) => (deg * Math.PI) / 180;
const wrapAngle = (angle) => {
    return ((((angle + 180) % 360) + 360) % 360) - 180;
}

export default function DefaultRotationMenu({ rotation, setRotation }) {
  const [localEulerDeg, setLocalEulerDeg] = useState({ x: 0, y: 0, z: 0 });

  const handleEulerChange = (newEulerDeg) => {
    // 1. Update local slider state
    setLocalEulerDeg(newEulerDeg);

    // 2. Convert new degrees to radians
    const eulerRad = new THREE.Euler(
      degToRad(newEulerDeg.x),
      degToRad(newEulerDeg.y),
      degToRad(newEulerDeg.z),
      // --- THIS IS THE FIX ---
      // Change rotation order to 'YXZ' for a Y-Up system
      'YXZ'
      // --- END FIX ---
    );

    // 3. Convert Euler to Quaternion and update global state
    setRotation(new THREE.Quaternion().setFromEuler(eulerRad));
  };

  // Handle changes from any slider
  const handleSliderChange = (axis, value) => {
    const newEulerDeg = { ...localEulerDeg };
    newEulerDeg[axis] = parseFloat(value);
    handleEulerChange(newEulerDeg);
  };

  // Handle preset button clicks
  const handlePresetChange = (axis, angleToAdd) => {
    const currentAngle = localEulerDeg[axis];
    const newAngle = wrapAngle(currentAngle + angleToAdd);
    
    const newEulerDeg = { ...localEulerDeg };
    newEulerDeg[axis] = newAngle;
    handleEulerChange(newEulerDeg);
  };

  return (
    <>
      {/* --- X-AXIS --- */}
      <div className="slider-group">
        <label>X-Axis: {localEulerDeg.x.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={localEulerDeg.x}
          onChange={(e) => handleSliderChange('x', e.target.value)}
        />
        <div className="preset-buttons">
          <button onClick={() => handlePresetChange('x', -180)}>-180</button>
          <button onClick={() => handlePresetChange('x', -90)}>-90</button>
          <button onClick={() => handlePresetChange('x', 90)}>+90</button>
          <button onClick={() => handlePresetChange('x', 180)}>+180</button>
        </div>
      </div>
      
      {/* --- Y-AXIS --- */}
      <div className="slider-group">
        <label>Y-Axis: {localEulerDeg.y.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={localEulerDeg.y}
          onChange={(e) => handleSliderChange('y', e.target.value)}
        />
        <div className="preset-buttons">
          <button onClick={() => handlePresetChange('y', -180)}>-180</button>
          <button onClick={() => handlePresetChange('y', -90)}>-90</button>
          <button onClick={() => handlePresetChange('y', 90)}>+90</button>
          <button onClick={() => handlePresetChange('y', 180)}>+180</button>
        </div>
      </div>
      
      {/* --- Z-AXIS --- */}
      <div className="slider-group">
        <label>Z-Axis: {localEulerDeg.z.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={localEulerDeg.z}
          onChange={(e) => handleSliderChange('z', e.target.value)}
        />
        <div className="preset-buttons">
          <button onClick={() => handlePresetChange('z', -180)}>-180</button>
          <button onClick={() => handlePresetChange('z', -90)}>-90</button>
          <button onClick={() => handlePresetChange('z', 90)}>+90</button>
          <button onClick={() => handlePresetChange('z', 180)}>+180</button>
        </div>
      </div>
    </>
  );
}