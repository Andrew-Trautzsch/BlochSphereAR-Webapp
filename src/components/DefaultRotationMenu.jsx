import React from 'react';

// Helper to convert degrees to radians
const degToRad = (deg) => (deg * Math.PI) / 180;

// Helper to wrap angles between -180 and 180
const wrapAngle = (angle) => {
  return (angle + 180) % 360 - 180;
}

export default function SideMenu({ rotation, setRotation }) {
  // We manage state in radians, but sliders are more intuitive in degrees
  const rotDeg = {
    x: (rotation[0] * 180) / Math.PI,
    y: (rotation[1] * 180) / Math.PI,
    z: (rotation[2] * 180) / Math.PI,
  };

  // Handle changes from any slider
  const handleRotationChange = (axis, value) => {
    const newRotDeg = { ...rotDeg };
    newRotDeg[axis] = parseFloat(value); // Update the degree value for the correct axis

    // Set the state in radians for THREE.js
    setRotation([
      degToRad(newRotDeg.x),
      degToRad(newRotDeg.y),
      degToRad(newRotDeg.z),
    ]);
  };

  // Handle preset button clicks
  const handlePresetChange = (axis, angleToAdd) => {
    const currentAngle = rotDeg[axis];
    const newAngle = wrapAngle(currentAngle + angleToAdd);
    handleRotationChange(axis, newAngle);
  };

  return (
    <div className="side-menu">
      <h3>Default Rotation (Euler)</h3>
      
      {/* --- X-AXIS --- */}
      <div className="slider-group">
        <label>X-Axis: {rotDeg.x.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={rotDeg.x}
          onChange={(e) => handleRotationChange('x', e.target.value)}
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
        <label>Y-Axis: {rotDeg.y.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={rotDeg.y}
          onChange={(e) => handleRotationChange('y', e.target.value)}
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
        <label>Z-Axis: {rotDeg.z.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={rotDeg.z}
          onChange={(e) => handleRotationChange('z', e.target.value)}
        />
        <div className="preset-buttons">
          <button onClick={() => handlePresetChange('z', -180)}>-180</button>
          <button onClick={() => handlePresetChange('z', -90)}>-90</button>
          <button onClick={() => handlePresetChange('z', 90)}>+90</button>
          <button onClick={() => handlePresetChange('z', 180)}>+180</button>
        </div>
      </div>
    </div>
  );
}