import * as THREE from 'three';

export const degToRad = (deg) => (deg * Math.PI) / 180;

export const wrapAngle = (angle) => {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
};

// Helper to normalize a vector object {x, y, z}
export const normalizeAxis = (axis) => {
  const vec = new THREE.Vector3(axis.x, axis.y, axis.z);
  if (vec.lengthSq() === 0) {
    vec.set(0, 1, 0); // Default to Y-axis
  } else {
    vec.normalize();
  }
  return vec;
};