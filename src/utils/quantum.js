import * as THREE from 'three';

// ... (Keep your existing AXIS, GATES, and createGate code) ...

export const AXIS = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  H: new THREE.Vector3(1, 1, 0).normalize(), // Diagonal
};

const createGate = (axis, radAngle) => {
  return new THREE.Quaternion().setFromAxisAngle(axis, radAngle);
};

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

export const applyGate = (currentRotation, gateKey) => {
  const gateQuaternion = GATES[gateKey];
  if (!gateQuaternion) return currentRotation;
  const newRotation = new THREE.Quaternion();
  newRotation.multiplyQuaternions(gateQuaternion, currentRotation);
  return newRotation;
};

// --- NEW FUNCTION ---
// Calculates the final state after a sequence of gates
export const simulateCircuit = (startRotation, gateSequence) => {
  // Clone the start rotation so we don't mutate the original state
  let currentRotation = startRotation.clone();

  if (!gateSequence || gateSequence.length === 0) {
    return currentRotation;
  }

  // Apply gates in order (Left -> Right)
  gateSequence.forEach(gateName => {
    if (gateName && GATES[gateName]) {
        currentRotation = applyGate(currentRotation, gateName);
    }
  });

  return currentRotation;
};