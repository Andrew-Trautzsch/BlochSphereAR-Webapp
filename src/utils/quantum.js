import * as THREE from 'three';

// Define Axes
export const AXIS = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  // Hadamard axis (diagonal between X and Y)
  H: new THREE.Vector3(1, 1, 0).normalize(),
};

// Helper to create a gate quaternion
const createGate = (axis, radAngle) => {
  return new THREE.Quaternion().setFromAxisAngle(axis, radAngle);
};

// Define Gate Rotations
export const GATES = {
  X: createGate(AXIS.X, Math.PI),
  Y: createGate(AXIS.Y, Math.PI),
  Z: createGate(AXIS.Z, Math.PI),
  H: createGate(AXIS.H, Math.PI),
  S: createGate(AXIS.Y, Math.PI / 2),
  S_DAG: createGate(AXIS.Y, -Math.PI / 2),
  T: createGate(AXIS.Y, Math.PI / 4),
  T_DAG: createGate(AXIS.Y, -Math.PI / 4),
};

// Apply a gate to a current rotation
export const applyGate = (currentRotation, gateKey) => {
  const gateQuaternion = GATES[gateKey];
  if (!gateQuaternion) return currentRotation;

  const newRotation = new THREE.Quaternion();
  // Order: new = gate * current
  newRotation.multiplyQuaternions(gateQuaternion, currentRotation);
  return newRotation;
};