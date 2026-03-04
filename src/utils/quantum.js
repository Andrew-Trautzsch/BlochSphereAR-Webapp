import * as THREE from 'three';

// ============================================================
// Legacy Quaternion Gate System (used by the Sidebar manual controls)
// ============================================================

export const AXIS = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  H: new THREE.Vector3(1, 1, 0).normalize(),
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

// Kept for the Sidebar QuantumGates panel (direct single-qubit manipulation)
export const simulateCircuit = (startRotation, gateSequence) => {
  let currentRotation = startRotation.clone();
  if (!gateSequence || gateSequence.length === 0) return currentRotation;
  gateSequence.forEach(gateName => {
    if (gateName && GATES[gateName]) {
      currentRotation = applyGate(currentRotation, gateName);
    }
  });
  return currentRotation;
};

// ============================================================
// State Vector Quantum Simulation Engine
// ============================================================
// Complex numbers are plain 2-element arrays: [real, imag]

const cx     = (r, i = 0) => [r, i];
const cx_add = (a, b)     => [a[0] + b[0], a[1] + b[1]];
const cx_mul = (a, b)     => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cx_abs2 = (a)       => a[0]*a[0] + a[1]*a[1];

const INV_SQRT2 = 1 / Math.sqrt(2);
const COS_PI4   = Math.cos(Math.PI / 4); // 1/√2
const SIN_PI4   = Math.sin(Math.PI / 4); // 1/√2

// Standard quantum gate matrices, 2×2 complex.
// Convention: |0⟩ = [1,0]^T is at the north pole of the standard Bloch sphere.
const GATE_MATRICES = {
  X:     [[cx(0),         cx(1)          ], [cx(1),          cx(0)           ]],
  Y:     [[cx(0),         cx(0, -1)      ], [cx(0, 1),       cx(0)           ]],
  Z:     [[cx(1),         cx(0)          ], [cx(0),          cx(-1)          ]],
  H:     [[cx(INV_SQRT2), cx(INV_SQRT2)  ], [cx(INV_SQRT2),  cx(-INV_SQRT2) ]],
  S:     [[cx(1),         cx(0)          ], [cx(0),          cx(0, 1)        ]],
  S_DAG: [[cx(1),         cx(0)          ], [cx(0),          cx(0, -1)       ]],
  T:     [[cx(1),         cx(0)          ], [cx(0),          cx(COS_PI4, SIN_PI4) ]],
  T_DAG: [[cx(1),         cx(0)          ], [cx(0),          cx(COS_PI4, -SIN_PI4)]],
};

// ── Coordinate conversion ──────────────────────────────────────────────────
// Three.js visual convention: |0⟩ is drawn at Y = (0,1,0).
// Standard Bloch convention:  |0⟩ is at Z = (0,0,1).
//
// Forward (standard → Three.js):  (rx, ry, rz) → (rx,  rz, −ry)
// Inverse (Three.js → standard):  (tx, ty, tz) → (tx, −tz,  ty)

/**
 * Convert a Three.js direction vector (from applyQuaternion) to
 * a single-qubit state vector [α, β] using the standard Bloch sphere.
 */
export const blochToAmplitudes = (dirThreejs) => {
  const { x: tx, y: ty, z: tz } = dirThreejs;
  // Three.js → standard Bloch
  let rx = tx, ry = -tz, rz = ty;
  const len = Math.sqrt(rx*rx + ry*ry + rz*rz);
  if (len > 1e-10) { rx /= len; ry /= len; rz /= len; }
  else             { rx = 0;    ry = 0;    rz = 1;    } // default |0⟩

  // Spherical coordinates → state amplitudes
  // |ψ⟩ = cos(θ/2)|0⟩ + sin(θ/2)·e^{iφ}|1⟩
  const theta    = Math.acos(Math.max(-1, Math.min(1, rz)));
  const phi      = Math.atan2(ry, rx);
  const cosHalf  = Math.cos(theta / 2);
  const sinHalf  = Math.sin(theta / 2);
  return [
    cx(cosHalf, 0),
    cx(sinHalf * Math.cos(phi), sinHalf * Math.sin(phi)),
  ];
};

/**
 * Build an N-qubit state vector from individual qubit amplitudes
 * via tensor product. qubitAmplitudes[i] = [α_i, β_i].
 */
export const initStateVector = (qubitAmplitudes) => {
  let sv = [cx(1)];
  for (const [alpha, beta] of qubitAmplitudes) {
    const next = [];
    for (const amp of sv) {
      next.push(cx_mul(amp, alpha)); // |…0⟩ component
      next.push(cx_mul(amp, beta));  // |…1⟩ component
    }
    sv = next;
  }
  return sv;
};

/**
 * Apply a 2×2 gate matrix to qubit `targetQubit` in an N-qubit state vector.
 * Bit ordering: qubit 0 is the most-significant bit.
 */
export const applyGateToStateVector = (sv, gateKey, targetQubit, N) => {
  const gateMatrix = GATE_MATRICES[gateKey];
  if (!gateMatrix) return sv;

  const newSv   = sv.map(v => cx(v[0], v[1])); // mutable copy
  const dim     = 1 << N;
  const bitPos  = N - 1 - targetQubit;

  for (let i = 0; i < dim; i++) {
    if ((i >> bitPos) & 1) continue;       // only process the |…0…⟩ half
    const j  = i | (1 << bitPos);          // partner state |…1…⟩
    const a0 = sv[i], a1 = sv[j];
    newSv[i] = cx_add(cx_mul(gateMatrix[0][0], a0), cx_mul(gateMatrix[0][1], a1));
    newSv[j] = cx_add(cx_mul(gateMatrix[1][0], a0), cx_mul(gateMatrix[1][1], a1));
  }
  return newSv;
};

/**
 * Apply a CNOT gate.  Flips the target qubit whenever the control qubit is |1⟩.
 */
export const applyCNOT = (sv, controlQubit, targetQubit, N) => {
  const newSv      = sv.map(v => cx(v[0], v[1]));
  const dim        = 1 << N;
  const ctrlBitPos = N - 1 - controlQubit;
  const tgtBitPos  = N - 1 - targetQubit;

  for (let i = 0; i < dim; i++) {
    if (!((i >> ctrlBitPos) & 1)) continue; // control must be |1⟩
    const j = i ^ (1 << tgtBitPos);         // flip target bit
    if (i < j) {                             // swap each pair exactly once
      newSv[i] = cx(sv[j][0], sv[j][1]);
      newSv[j] = cx(sv[i][0], sv[i][1]);
    }
  }
  return newSv;
};

/**
 * Compute the reduced density matrix of qubit `qubitIdx` via partial trace,
 * then return its Bloch vector in the STANDARD convention.
 * Returns { x, y, z, length } where length = 1 for pure, 0 for maximally mixed.
 */
export const getBlochVector = (sv, qubitIdx, N) => {
  const dim    = 1 << N;
  const bitPos = N - 1 - qubitIdx;
  const envDim = dim >> 1; // 2^(N-1)

  let rho00  = 0;           // Σ |sv[idx0]|²
  let rho01r = 0;           // Re( Σ sv[idx0]·sv[idx1]* )
  let rho01i = 0;           // Im( Σ sv[idx0]·sv[idx1]* )

  for (let env = 0; env < envDim; env++) {
    // Insert a 0-bit at bitPos to get the index with qubitIdx = 0
    const lower = env & ((1 << bitPos) - 1);
    const upper = (env >> bitPos) << (bitPos + 1);
    const idx0  = upper | lower;             // qubitIdx = 0
    const idx1  = idx0  | (1 << bitPos);     // qubitIdx = 1

    rho00  += cx_abs2(sv[idx0]);
    // sv[idx0] · conj(sv[idx1]):  [ar,ai]·[br,-bi] → [ar·br+ai·bi, ai·br−ar·bi]
    rho01r += sv[idx0][0]*sv[idx1][0] + sv[idx0][1]*sv[idx1][1];
    rho01i += sv[idx0][1]*sv[idx1][0] - sv[idx0][0]*sv[idx1][1];
  }

  // Bloch vector components:
  //   rx = Tr(ρ σx) = 2·Re(ρ₀₁)
  //   ry = Tr(ρ σy) = −2·Im(ρ₀₁)   (derived from σy = [[0,−i],[i,0]])
  //   rz = Tr(ρ σz) = ρ₀₀ − ρ₁₁  = 2·ρ₀₀ − 1
  const rx  = 2 * rho01r;
  const ry  = -2 * rho01i;
  const rz  = 2 * rho00 - 1;
  const len = Math.sqrt(rx*rx + ry*ry + rz*rz);

  return { x: rx, y: ry, z: rz, length: len };
};

/**
 * Full circuit simulation using state vectors.
 *
 * For each time step up to `currentStep`:
 *   1. Apply single-qubit gates (X, Y, Z, H, S, T, …)
 *   2. Apply CNOT pairs: the first 'C' controls the first 'TG' in the same
 *      column, second 'C' controls second 'TG', and so on.
 *
 * Returns an array of Three.js Bloch vectors for each qubit:
 *   { x, y, z, length }
 * where `length` ∈ [0,1] indicates state purity
 * (1 = pure state on sphere surface, 0 = maximally mixed / entangled).
 *
 * Coordinate mapping (standard → Three.js):  (rx, ry, rz) → (rx, rz, −ry)
 */
export const simulateCircuitStateVector = (qubits, circuit, currentStep) => {
  const N = qubits.length;
  if (N === 0) return [];

  // Build initial per-qubit amplitudes from stored quaternions
  const initialAmps = qubits.map(q => {
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q.rotation);
    return blochToAmplitudes(dir);
  });

  let sv = initStateVector(initialAmps);

  for (let step = 0; step < currentStep; step++) {
    // 1. Single-qubit gates
    qubits.forEach((q, qi) => {
      const gate = circuit[q.id]?.[step];
      if (gate && GATE_MATRICES[gate]) {
        sv = applyGateToStateVector(sv, gate, qi, N);
      }
    });

    // 2. CNOT pairs — match controls to targets by row order
    const controls = [];
    const targets  = [];
    qubits.forEach((q, qi) => {
      const gate = circuit[q.id]?.[step];
      if (gate === 'C')  controls.push(qi);
      if (gate === 'TG') targets.push(qi);
    });
    const numPairs = Math.min(controls.length, targets.length);
    for (let p = 0; p < numPairs; p++) {
      sv = applyCNOT(sv, controls[p], targets[p], N);
    }
  }

  // Extract Bloch vectors and convert to Three.js coordinates
  return qubits.map((_, qi) => {
    const std = getBlochVector(sv, qi, N);
    // Standard (rx, ry, rz) → Three.js (rx, rz, −ry)
    return { x: std.x, y: std.z, z: -std.y, length: std.length };
  });
};
