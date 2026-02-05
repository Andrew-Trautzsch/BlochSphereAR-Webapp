import React, { useState } from 'react';
import * as THREE from 'three';
import { degToRad, normalizeAxis } from '../../../utils/math';

export default function CustomRotation({ setRotation }) {
  const [axis, setAxis] = useState({ x: 0, y: 0, z: 1 });
  const [angle, setAngle] = useState(0);

  const updateGlobal = (newAxis, newAngle) => {
    const normAxis = normalizeAxis(newAxis);
    const radAngle = degToRad(newAngle);
    setRotation(new THREE.Quaternion().setFromAxisAngle(normAxis, radAngle));
  };

  const handleAxisChange = (key, val) => {
    const newAxis = { ...axis, [key]: parseFloat(val) || 0 };
    setAxis(newAxis);
    updateGlobal(newAxis, angle);
  };

  const handleAngleChange = (val) => {
    const newAngle = parseFloat(val);
    setAngle(newAngle);
    updateGlobal(axis, newAngle);
  };

  return (
    <div className="custom-rotation-menu">
      <p className="hint-text">Define a 3D vector to rotate around.</p>
      
      {['x', 'y', 'z'].map((key) => (
        <div className="input-group" key={key}>
          <label>Axis Vector ({key.toUpperCase()}):</label>
          <input 
            type="number" step="0.1"
            value={axis[key]}
            onChange={(e) => handleAxisChange(key, e.target.value)}
          />
        </div>
      ))}
      
      <div className="slider-group">
        <label>Angle: {angle.toFixed(0)}°</label>
        <input
          type="range" min="0" max="360" step="1"
          value={angle}
          onChange={(e) => handleAngleChange(e.target.value)}
        />
      </div>
    </div>
  );
}