import React, { useState } from 'react';
import * as THREE from 'three';
import { degToRad, wrapAngle } from '../../../utils/math';

export default function DefaultRotation({ setRotation }) {
  const [euler, setEuler] = useState({ x: 0, y: 0, z: 0 });

  const updateRotation = (newEuler) => {
    setEuler(newEuler);
    
    // Create Euler rotation (YXZ order for Y-up system)
    const eulerRad = new THREE.Euler(
      degToRad(newEuler.x),
      degToRad(newEuler.y),
      degToRad(newEuler.z),
      'YXZ'
    );
    
    setRotation(new THREE.Quaternion().setFromEuler(eulerRad));
  };

  const handleChange = (axis, value) => {
    updateRotation({ ...euler, [axis]: parseFloat(value) });
  };

  const handlePreset = (axis, delta) => {
    updateRotation({ 
      ...euler, 
      [axis]: wrapAngle(euler[axis] + delta) 
    });
  };

  const renderSlider = (axis) => (
    <div className="slider-group" key={axis}>
      <label>{axis.toUpperCase()}-Axis: {euler[axis].toFixed(0)}°</label>
      <input
        type="range"
        min="-180" max="180" step="1"
        value={euler[axis]}
        onChange={(e) => handleChange(axis, e.target.value)}
      />
      <div className="preset-buttons">
        <button onClick={() => handlePreset(axis, -180)}>-180</button>
        <button onClick={() => handlePreset(axis, -90)}>-90</button>
        <button onClick={() => handlePreset(axis, 90)}>+90</button>
        <button onClick={() => handlePreset(axis, 180)}>+180</button>
      </div>
    </div>
  );

  return (
    <div className="default-rotation-menu">
      {['x', 'y', 'z'].map(renderSlider)}
    </div>
  );
}