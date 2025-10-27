import React from 'react';
import * as THREE from 'three';

// Helper:
// Creates a new quaternion by multiplying the current one by the gate's rotation
// Order matters: newRotation = gateRotation * currentRotation
const applyGate = (currentRotation, gateQuaternion) => {
  const newRotation = new THREE.Quaternion();
  newRotation.multiplyQuaternions(gateQuaternion, currentRotation);
  return newRotation;
};

// Helper to create a gate (a quaternion) from an axis and angle
// --- THIS IS THE FIX ---
const createGate = (axis, rad_angle) => {
// --- END FIX ---
  return new THREE.Quaternion().setFromAxisAngle(axis, rad_angle);
};

// --- Define Axes ---
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// Hadamard axis (diagonal between X and Y, since Y is our |0⟩ axis)
const H_AXIS = new THREE.Vector3(1, 1, 0).normalize();

// --- Define Gate Rotations (as Quaternions) ---
const GATES = {
  X: createGate(X_AXIS, Math.PI),       // Pauli-X: 180° around X
  Y: createGate(Y_AXIS, Math.PI),       // Pauli-Y: 180° around Y
  Z: createGate(Z_AXIS, Math.PI),       // Pauli-Z: 180° around Z
  H: createGate(H_AXIS, Math.PI),       // Hadamard: 180° around (X+Y)
  S: createGate(Y_AXIS, Math.PI / 2),   // S Gate: 90° around Y (polar axis)
  S_DAG: createGate(Y_AXIS, -Math.PI / 2), // S† Gate: -90° around Y
  T: createGate(Y_AXIS, Math.PI / 4),   // T Gate: 45° around Y
  T_DAG: createGate(Y_AXIS, -Math.PI / 4), // T† Gate: -45° around Y
};

export default function QuantumGatesMenu({ rotation, setRotation }) {
  
  const handleGateClick = (gate) => {
    const gateQuaternion = GATES[gate];
    setRotation(applyGate(rotation, gateQuaternion));
  };

  return (
    <div className="gate-menu">
      <p>Apply a gate to the current state.</p>
      
      <h4>Pauli Gates</h4>
      <div className="gate-button-group">
        <button onClick={() => handleGateClick('X')}>X</button>
        <button onClick={() => handleGateClick('Y')}>Y</button>
        <button onClick={() => handleGateClick('Z')}>Z</button>
      </div>

      <h4>Hadamard</h4>
      <div className="gate-button-group">
        <button onClick={() => handleGateClick('H')}>H</button>
      </div>

      <h4>Phase Gates (around Y)</h4>
      <div className="gate-button-group">
        <button onClick={() => handleGateClick('S')}>S</button>
        <button onClick={() => handleGateClick('S_DAG')}>S†</button>
        <button onClick={() => handleGateClick('T')}>T</button>
        <button onClick={() => handleGateClick('T_DAG')}>T†</button>
      </div>
    </div>
  );
}