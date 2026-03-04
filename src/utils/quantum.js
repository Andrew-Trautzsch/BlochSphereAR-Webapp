import * as THREE from 'three';

// ============================================================
// LEGACY QUATERNION-BASED GATES  (sidebar single-qubit controls)
// Unchanged — sidebar rotations still use quaternions directly.
// ============================================================

export const AXIS = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  H: new THREE.Vector3(1, 1, 0).normalize(),
};

const createGate = (axis, radAngle) =>
  new THREE.Quaternion().setFromAxisAngle(axis, radAngle);

export const GATES = {
  X:     createGate(AXIS.X, Math.PI),
  Y:     createGate(AXIS.Y, Math.PI),
  Z:     createGate(AXIS.Z, Math.PI),
  H:     createGate(AXIS.H, Math.PI),
  S:     createGate(AXIS.Y,  Math.PI / 2),
  S_DAG: createGate(AXIS.Y, -Math.PI / 2),
  T:     createGate(AXIS.Y,  Math.PI / 4),
  T_DAG: createGate(AXIS.Y, -Math.PI / 4),
};

export const applyGate = (currentRotation, gateKey) => {
  const gateQuaternion = GATES[gateKey];
  if (!gateQuaternion) return currentRotation;
  return new THREE.Quaternion().multiplyQuaternions(gateQuaternion, currentRotation);
};

// Legacy single-qubit simulation (used by Sidebar quantum gate buttons)
export const simulateCircuit = (startRotation, gateSequence) => {
  let rot = startRotation.clone();
  if (!gateSequence || gateSequence.length === 0) return rot;
  gateSequence.forEach(g => { if (g && GATES[g]) rot = applyGate(rot, g); });
  return rot;
};

// ============================================================
// STATE VECTOR SIMULATION
// ============================================================
//
// Axis convention — matches BlochSphere's original arrow calculation:
//   Original display:  dir = new THREE.Vector3(0,1,0).applyQuaternion(quat)
//
//   THREE.js (dx, dy, dz)  ↔  quantum Bloch (bx, by, bz)
//     bx =  dx       (THREE.js X  = quantum X)
//     by = -dz       (THREE.js Z  = -quantum Y)
//     bz =  dy       (THREE.js Y  =  quantum Z  — the |0⟩ pole)
//
//   Inverse: dx = bx,  dy = bz,  dz = -by
//
//   Bloch ↔ density matrix (standard):
//     bx =  2 Re(ρ₀₁)
//     by = -2 Im(ρ₀₁)   ← note minus: Tr(ρ σy) = -2 Im(ρ₀₁)
//     bz =  2ρ₀₀ − 1

const SQRT2_INV = 1 / Math.sqrt(2);

// 2×2 complex gate matrices, row-major as
//   [a0r,a0i, a1r,a1i,   b0r,b0i, b1r,b1i]
// representing  [[a0, a1], [b0, b1]]
const GATE_MATRICES = {
  H:     [ SQRT2_INV,0,  SQRT2_INV,0,    SQRT2_INV,0, -SQRT2_INV,0 ],
  X:     [ 0,0,  1,0,   1,0,  0,0 ],
  Y:     [ 0,0,  0,-1,  0,1,  0,0 ],
  Z:     [ 1,0,  0,0,   0,0, -1,0 ],
  S:     [ 1,0,  0,0,   0,0,  0,1 ],
  T:     [ 1,0,  0,0,   0,0,  SQRT2_INV, SQRT2_INV ],
  S_DAG: [ 1,0,  0,0,   0,0,  0,-1 ],
  T_DAG: [ 1,0,  0,0,   0,0,  SQRT2_INV,-SQRT2_INV ],
};

// ── Internal helpers ──────────────────────────────────────────

/**
 * Convert a qubit's quaternion to two-component complex amplitudes [αr,αi,βr,βi].
 *
 * KEY FIX: amplitudes are derived directly from the Bloch direction vector —
 * NO acos/atan2/cos/sin round-trip — so axis-aligned states stay bit-exact
 * and off-axis states have no accumulated trig error.
 *
 * Given unit Bloch vector (bx, by, bz):
 *   α  =  sqrt((1 + bz) / 2)          (real, non-negative — global phase choice)
 *   β  =  (bx + i·by) / (2α)          if α > ε
 *   β  =  1                             if α ≈ 0  (south pole |1⟩)
 */
const quaternionToAmplitudes = (quat) => {
  // Direction the Bloch arrow points in THREE.js coordinates
  const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);

  // THREE.js → quantum Bloch
  const bx =  dir.x;
  const by = -dir.z;   // THREE.js Z = -quantum Y
  const bz =  dir.y;   // THREE.js Y =  quantum Z (|0⟩ pole)

  // α is real and ≥ 0 (global-phase convention)
  const ar = Math.sqrt(Math.max(0, (1 + bz) * 0.5));
  const ai = 0;

  let br, bi;
  if (ar > 1e-10) {
    // β = (bx + i·by) / (2α)
    br = bx / (2 * ar);
    bi = by / (2 * ar);
  } else {
    // South pole: |1⟩, α≈0, β≈1
    br = 1;
    bi = 0;
  }

  return [ar, ai, br, bi];
};

/**
 * Build the 2ⁿ-element product state from individual qubit amplitudes.
 * Qubit 0 is the most-significant bit of the basis index.
 * Returns Float64Array of [re₀, im₀, re₁, im₁, …].
 */
const buildProductState = (ampArr) => {
  const n   = ampArr.length;
  const dim = 1 << n;
  const state = new Float64Array(dim * 2);

  for (let k = 0; k < dim; k++) {
    let re = 1, im = 0;
    for (let q = 0; q < n; q++) {
      const bit = (k >> (n - 1 - q)) & 1;
      const [ar, ai, br, bi] = ampArr[q];
      const [cr, ci] = bit === 0 ? [ar, ai] : [br, bi];
      [re, im] = [re * cr - im * ci, re * ci + im * cr];
    }
    state[k * 2]     = re;
    state[k * 2 + 1] = im;
  }
  return state;
};

/**
 * Apply a 1-qubit unitary to qubit at index `qubitIdx` (0 = MSB).
 * Returns a new state vector; the input is untouched.
 */
const applySingleGate = (state, n, qubitIdx, mat) => {
  const [a0r, a0i, a1r, a1i,
         b0r, b0i, b1r, b1i] = mat;

  const dim    = 1 << n;
  const bitPos = n - 1 - qubitIdx;
  const out    = new Float64Array(state.length);

  for (let k = 0; k < dim; k++) {
    if (((k >> bitPos) & 1) !== 0) continue; // only the |0⟩ half of each pair

    const k1 = k | (1 << bitPos);

    const s0r = state[k  * 2], s0i = state[k  * 2 + 1];
    const s1r = state[k1 * 2], s1i = state[k1 * 2 + 1];

    out[k  * 2]     = a0r*s0r - a0i*s0i + a1r*s1r - a1i*s1i;
    out[k  * 2 + 1] = a0r*s0i + a0i*s0r + a1r*s1i + a1i*s1r;

    out[k1 * 2]     = b0r*s0r - b0i*s0i + b1r*s1r - b1i*s1i;
    out[k1 * 2 + 1] = b0r*s0i + b0i*s0r + b1r*s1i + b1i*s1r;
  }
  return out;
};

/**
 * Apply a CNOT gate: flip targetIdx when controlIdx is |1⟩.
 * CNOT only permutes amplitudes (no phase factors).
 */
const applyCNOT = (state, n, controlIdx, targetIdx) => {
  const dim  = 1 << n;
  const cBit = n - 1 - controlIdx;
  const tBit = n - 1 - targetIdx;
  const out  = new Float64Array(state.length);

  for (let k = 0; k < dim; k++) {
    if (((k >> cBit) & 1) === 1) {
      const k2 = k ^ (1 << tBit);
      out[k2 * 2]     = state[k * 2];
      out[k2 * 2 + 1] = state[k * 2 + 1];
    } else {
      out[k * 2]     = state[k * 2];
      out[k * 2 + 1] = state[k * 2 + 1];
    }
  }
  return out;
};

/**
 * Compute a qubit's Bloch vector via partial trace of the full state.
 *
 * Returns { direction: THREE.Vector3 (unit), purity: number 0–1 }
 *
 *  - Pure product state  → purity = 1.0   (arrow at sphere surface)
 *  - Entangled qubit     → purity < 1     (arrow shrinks toward origin)
 *
 * Numerical stability: purity is clamped to [0,1] so floating-point noise
 * can never push a pure state below 1 in any measurable way.
 */
const partialTraceBloch = (state, n, qubitIdx) => {
  const dim    = 1 << n;
  const bitPos = n - 1 - qubitIdx;

  let rho00  = 0;
  let rho01r = 0;
  let rho01i = 0;

  for (let k = 0; k < dim; k++) {
    if (((k >> bitPos) & 1) !== 0) continue;

    const kr  = state[k  * 2],     ki  = state[k  * 2 + 1];
    const k1  = k | (1 << bitPos);
    const k1r = state[k1 * 2],     k1i = state[k1 * 2 + 1];

    rho00  += kr * kr + ki * ki;

    // ρ₀₁ += amp_k · conj(amp_k1)
    rho01r += kr * k1r + ki * k1i;
    rho01i += ki * k1r - kr * k1i;
  }

  // Quantum Bloch vector components
  const bx =  2 * rho01r;
  const by = -2 * rho01i;  // Tr(ρ σy) = -2 Im(ρ₀₁) — the minus is correct
  const bz =  2 * rho00 - 1;

  // Purity = |Bloch vector| (exact for a qubit)
  // Clamp to [0,1] to absorb any sub-ULP floating-point noise so pure states
  // always render at full arrow length.
  const blochLen = Math.sqrt(bx * bx + by * by + bz * bz);
  const purity   = Math.min(1, blochLen);

  // Convert quantum Bloch → THREE.js display coords: (bx, bz, -by)
  const dx = bx;
  const dy = bz;
  const dz = -by;

  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const direction = len > 1e-9
    ? new THREE.Vector3(dx / len, dy / len, dz / len)
    : new THREE.Vector3(0, 1, 0); // fallback to |0⟩ when at origin

  return { direction, purity };
};

// ── Public API ────────────────────────────────────────────────

/**
 * Simulate the full quantum circuit and return per-qubit Bloch data.
 *
 * @param {Array}  qubits   — App qubit objects (.id, .rotation)
 * @param {Object} circuit  — { [qubitId]: [gate|null, …] }
 * @param {number} maxStep  — columns to apply (0 = initial state only)
 * @returns {Array<{ direction: THREE.Vector3, purity: number }>}
 */
export const simulateAllQubits = (qubits, circuit, maxStep) => {
  const n = qubits.length;
  if (n === 0) return [];

  // 1. Build product state from each qubit's current rotation quaternion
  const ampArr = qubits.map(q => quaternionToAmplitudes(q.rotation));
  let state    = buildProductState(ampArr);

  // 2. Walk through the circuit step by step
  for (let step = 0; step < maxStep; step++) {
    const controls = [];
    const targets  = [];

    qubits.forEach((q, idx) => {
      const gate = circuit[q.id]?.[step];
      if (!gate) return;

      if (gate === 'C')  { controls.push(idx); return; }
      if (gate === 'TG') { targets.push(idx);  return; }

      const mat = GATE_MATRICES[gate];
      if (mat) state = applySingleGate(state, n, idx, mat);
    });

    // Pair controls with targets in the order they appear
    const pairs = Math.min(controls.length, targets.length);
    for (let p = 0; p < pairs; p++) {
      state = applyCNOT(state, n, controls[p], targets[p]);
    }
  }

  // 3. Partial-trace each qubit
  return qubits.map((_, idx) => partialTraceBloch(state, n, idx));
};