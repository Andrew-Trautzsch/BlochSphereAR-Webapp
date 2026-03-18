import * as THREE from 'three';

// ============================================================
// LEGACY QUATERNION-BASED GATES  (sidebar single-qubit controls)
// These drive the arrow directly via quaternion rotation.
// Axis convention — Bloch arrow = (0,1,0).applyQuaternion(quat)
//   THREE.js X = quantum X
//   THREE.js Y = quantum Z  (|0⟩ pole is Y-up)
//   THREE.js Z = −quantum Y
// ============================================================

export const AXIS = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  H: new THREE.Vector3(1, 1, 0).normalize(),
};

const createGate = (axis, radAngle) =>
  new THREE.Quaternion().setFromAxisAngle(axis, radAngle);

// FIXED: Y and Z axes were previously swapped.
//   Pauli Z rotates around quantum Z  = THREE.js Y → use AXIS.Y
//   Pauli Y rotates around quantum −Y = THREE.js Z → use AXIS.Z
//   (π-rotation so sign of axis does not matter)
export const GATES = {
  X:     createGate(AXIS.X, Math.PI),
  Y:     createGate(AXIS.Z, Math.PI),          // was AXIS.Y  ← bug fixed
  Z:     createGate(AXIS.Y, Math.PI),          // was AXIS.Z  ← bug fixed
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
// Axis convention — matches the original BlochSphere arrow:
//   Arrow direction = new THREE.Vector3(0,1,0).applyQuaternion(quat)
//
//   THREE.js (dx, dy, dz)  ↔  quantum Bloch (bx, by, bz):
//     bx =  dx       (THREE.js X  = quantum X)
//     by = −dz       (THREE.js Z  = −quantum Y)
//     bz =  dy       (THREE.js Y  =  quantum Z, the |0⟩ pole)
//
//   Inverse: dx = bx,  dy = bz,  dz = −by
//
//   Bloch ↔ density matrix (standard):
//     bx =  2 Re(ρ₀₁)
//     by = −2 Im(ρ₀₁)   ← minus sign: Tr(ρ σy) = −2 Im(ρ₀₁)
//     bz =  2ρ₀₀ − 1

const SQRT2_INV = 1 / Math.sqrt(2);

// 2×2 complex gate matrices, row-major:
//   [a0r,a0i, a1r,a1i,   b0r,b0i, b1r,b1i]
// → [[a0, a1], [b0, b1]]
const GATE_MATRICES = {
  H:     [ SQRT2_INV,0,  SQRT2_INV,0,    SQRT2_INV,0, -SQRT2_INV,0 ],
  X:     [ 0,0,  1,0,   1,0,  0,0 ],
  Y:     [ 0,0,  0,-1,  0,1,  0,0 ],          // [[0,−i],[i,0]] ✓
  Z:     [ 1,0,  0,0,   0,0, -1,0 ],          // [[1,0],[0,−1]] ✓
  S:     [ 1,0,  0,0,   0,0,  0,1 ],          // [[1,0],[0,i]]  ✓
  T:     [ 1,0,  0,0,   0,0,  SQRT2_INV, SQRT2_INV ],
  S_DAG: [ 1,0,  0,0,   0,0,  0,-1 ],
  T_DAG: [ 1,0,  0,0,   0,0,  SQRT2_INV,-SQRT2_INV ],
};

// ── Internal helpers ──────────────────────────────────────────

/**
 * Convert a qubit's quaternion to complex amplitudes [αr,αi,βr,βi].
 *
 * Derived directly from the Bloch direction vector — no acos/atan2 round-trip,
 * so axis-aligned states stay bit-exact with no accumulated trig error.
 *
 *   Given Bloch unit vector (bx, by, bz):
 *     α  = sqrt((1 + bz) / 2)          (real, ≥ 0 — global phase choice)
 *     β  = (bx + i·by) / (2α)          if α > ε
 *     β  = 1                             if α ≈ 0  (south pole |1⟩)
 */
const quaternionToAmplitudes = (quat) => {
  const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);

  // THREE.js → quantum Bloch
  const bx =  dir.x;
  const by = -dir.z;   // THREE.js Z = −quantum Y
  const bz =  dir.y;   // THREE.js Y =  quantum Z

  const ar = Math.sqrt(Math.max(0, (1 + bz) * 0.5));
  const ai = 0;

  let br, bi;
  if (ar > 1e-10) {
    br = bx / (2 * ar);
    bi = by / (2 * ar);
  } else {
    br = 1; bi = 0; // south pole |1⟩
  }

  return [ar, ai, br, bi];
};

/**
 * Build the 2ⁿ-element product state from per-qubit amplitudes.
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
 */
const applySingleGate = (state, n, qubitIdx, mat) => {
  const [a0r,a0i,a1r,a1i,b0r,b0i,b1r,b1i] = mat;
  const dim    = 1 << n;
  const bitPos = n - 1 - qubitIdx;
  const out    = new Float64Array(state.length);

  for (let k = 0; k < dim; k++) {
    if (((k >> bitPos) & 1) !== 0) continue;
    const k1 = k | (1 << bitPos);
    const s0r=state[k*2],   s0i=state[k*2+1];
    const s1r=state[k1*2],  s1i=state[k1*2+1];

    out[k*2]    = a0r*s0r - a0i*s0i + a1r*s1r - a1i*s1i;
    out[k*2+1]  = a0r*s0i + a0i*s0r + a1r*s1i + a1i*s1r;
    out[k1*2]   = b0r*s0r - b0i*s0i + b1r*s1r - b1i*s1i;
    out[k1*2+1] = b0r*s0i + b0i*s0r + b1r*s1i + b1i*s1r;
  }
  return out;
};

/**
 * CNOT: flip targetIdx when controlIdx is |1⟩.
 */
const applyCNOT = (state, n, controlIdx, targetIdx) => {
  const dim  = 1 << n;
  const cBit = n - 1 - controlIdx;
  const tBit = n - 1 - targetIdx;
  const out  = new Float64Array(state.length);

  for (let k = 0; k < dim; k++) {
    if (((k >> cBit) & 1) === 1) {
      const k2 = k ^ (1 << tBit);
      out[k2*2]   = state[k*2];
      out[k2*2+1] = state[k*2+1];
    } else {
      out[k*2]   = state[k*2];
      out[k*2+1] = state[k*2+1];
    }
  }
  return out;
};

/**
 * CZ: apply a −1 phase to the |11⟩ component.
 * Symmetric — both qubits act as control and target simultaneously.
 */
const applyCZ = (state, n, qubitA, qubitB) => {
  const dim  = 1 << n;
  const bA   = n - 1 - qubitA;
  const bB   = n - 1 - qubitB;
  const out  = new Float64Array(state.length);

  for (let k = 0; k < dim; k++) {
    if (((k >> bA) & 1) === 1 && ((k >> bB) & 1) === 1) {
      out[k*2]   = -state[k*2];
      out[k*2+1] = -state[k*2+1];
    } else {
      out[k*2]   = state[k*2];
      out[k*2+1] = state[k*2+1];
    }
  }
  return out;
};

/**
 * SWAP: exchange the amplitudes of qubitA and qubitB.
 */
const applySWAP = (state, n, qubitA, qubitB) => {
  const dim = 1 << n;
  const bA  = n - 1 - qubitA;
  const bB  = n - 1 - qubitB;
  const out = new Float64Array(state.length);

  for (let k = 0; k < dim; k++) {
    const bitA = (k >> bA) & 1;
    const bitB = (k >> bB) & 1;
    if (bitA !== bitB) {
      // Swap the two qubit bits → write to the mirror index
      const k2 = k ^ (1 << bA) ^ (1 << bB);
      out[k2*2]   = state[k*2];
      out[k2*2+1] = state[k*2+1];
    } else {
      out[k*2]   = state[k*2];
      out[k*2+1] = state[k*2+1];
    }
  }
  return out;
};

/**
 * Partial trace → per-qubit Bloch vector.
 *
 * Returns { direction: THREE.Vector3 (unit), purity: number 0–1 }
 *   purity = 1  →  pure, arrow at sphere surface
 *   purity < 1  →  entangled/mixed, arrow shorter
 */
const partialTraceBloch = (state, n, qubitIdx) => {
  const dim    = 1 << n;
  const bitPos = n - 1 - qubitIdx;
  let rho00 = 0, rho01r = 0, rho01i = 0;

  for (let k = 0; k < dim; k++) {
    if (((k >> bitPos) & 1) !== 0) continue;
    const kr  = state[k*2],    ki  = state[k*2+1];
    const k1  = k | (1 << bitPos);
    const k1r = state[k1*2],   k1i = state[k1*2+1];

    rho00  += kr * kr + ki * ki;
    rho01r += kr * k1r + ki * k1i;     //  Re(ρ₀₁)
    rho01i += ki * k1r - kr * k1i;     //  Im(ρ₀₁)
  }

  // Standard Bloch components
  const bx =  2 * rho01r;
  const by = -2 * rho01i;              // Tr(ρ σy) = −2 Im(ρ₀₁)
  const bz =  2 * rho00 - 1;

  const blochLen = Math.sqrt(bx*bx + by*by + bz*bz);
  const purity   = Math.min(1, blochLen); // clamp float noise on pure states

  // Quantum Bloch → THREE.js display: (bx, bz, −by)
  const dx = bx, dy = bz, dz = -by;
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  const direction = len > 1e-9
    ? new THREE.Vector3(dx/len, dy/len, dz/len)
    : new THREE.Vector3(0, 1, 0); // fallback: |0⟩

  return { direction, purity };
};

// ============================================================
// CIRCUIT PRESET GENERATORS
// Each returns a circuit object { [qubitId]: gateName[] }
// ready to be passed directly to setCircuit() in App.jsx.
// ============================================================

/**
 * Φ+ Bell state circuit.
 *   qubitIds = [q0, q1], both starting in |0⟩
 *   Step 1: H on q0
 *   Step 2: CNOT(q0 → q1)
 *   Result: (|00⟩ + |11⟩) / √2
 */
export const createBellStateCircuit = ([q0Id, q1Id]) => ({
  [q0Id]: ['H', 'C'],
  [q1Id]: [null, 'TG'],
});

/**
 * GHZ state circuit (any number of qubits ≥ 2).
 *   Step 1:   H on q0
 *   Steps 2…n: CNOT(q0 → qᵢ) for each remaining qubit
 *   Result: (|00…0⟩ + |11…1⟩) / √2
 */
export const createGHZCircuit = (qubitIds) => {
  const n = qubitIds.length;
  const circuit = {};
  qubitIds.forEach(id => { circuit[id] = new Array(n).fill(null); });

  circuit[qubitIds[0]][0] = 'H';
  for (let i = 1; i < n; i++) {
    circuit[qubitIds[0]][i] = 'C';
    circuit[qubitIds[i]][i] = 'TG';
  }
  return circuit;
};

/**
 * Quantum teleportation circuit — unitary portion only.
 *   qubitIds = [input, alice, bob]
 *   Step 1: H on alice               (start Bell pair)
 *   Step 2: CNOT(alice → bob)        (complete Bell pair)
 *   Step 3: CNOT(input → alice)      (Alice entangles with input)
 *   Step 4: H on input               (rotate to X-basis for measurement)
 *
 *   Note: Classical correction (X on bob if alice=1, Z on bob if input=1)
 *   requires measurement collapse and is not modelled here.
 *   After step 4 the "teleported" state is encoded in bob's reduced density
 *   matrix, but all three qubits show purity ≈ 0 (maximally entangled).
 */
export const createTeleportationCircuit = ([q0Id, q1Id, q2Id]) => ({
  [q0Id]: [null,  null,  'C',   'H'],
  [q1Id]: ['H',   'C',   'TG',  null],
  [q2Id]: [null,  'TG',  null,  null],
});

// ============================================================
// PUBLIC SIMULATION API
// ============================================================

/**
 * Simulate the full quantum circuit and return per-qubit Bloch data.
 *
 * Supported circuit gate tokens:
 *   Single-qubit:  H  X  Y  Z  S  T  S_DAG  T_DAG
 *   CNOT:          C  (control)  +  TG (target)
 *   CZ:            CZC (control) +  CZT (target)   — symmetric
 *   SWAP:          SWA + SWB                        — symmetric
 *
 * @param {Array}  qubits   — App qubit objects (.id, .rotation)
 * @param {Object} circuit  — { [qubitId]: [gate|null, …] }
 * @param {number} maxStep  — columns to apply (0 = initial state only)
 * @returns {Array<{ direction: THREE.Vector3, purity: number }>}
 */
export const simulateAllQubits = (qubits, circuit, maxStep) => {
  const n = qubits.length;
  if (n === 0) return [];

  const ampArr = qubits.map(q => quaternionToAmplitudes(q.rotation));
  let state    = buildProductState(ampArr);

  for (let step = 0; step < maxStep; step++) {
    const cnotControls = [];
    const cnotTargets  = [];
    const czA          = [];
    const czB          = [];
    const swapA        = [];
    const swapB        = [];

    qubits.forEach((q, idx) => {
      const gate = circuit[q.id]?.[step];
      if (!gate) return;

      switch (gate) {
        case 'C':   cnotControls.push(idx); break;
        case 'TG':  cnotTargets.push(idx);  break;
        case 'CZC': czA.push(idx);          break;
        case 'CZT': czB.push(idx);          break;
        case 'SWA': swapA.push(idx);        break;
        case 'SWB': swapB.push(idx);        break;
        default: {
          const mat = GATE_MATRICES[gate];
          if (mat) state = applySingleGate(state, n, idx, mat);
        }
      }
    });

    // CNOT pairs (control[i] → target[i])
    const cnotPairs = Math.min(cnotControls.length, cnotTargets.length);
    for (let p = 0; p < cnotPairs; p++)
      state = applyCNOT(state, n, cnotControls[p], cnotTargets[p]);

    // CZ pairs (symmetric)
    const czPairs = Math.min(czA.length, czB.length);
    for (let p = 0; p < czPairs; p++)
      state = applyCZ(state, n, czA[p], czB[p]);

    // SWAP pairs (symmetric)
    const swapPairs = Math.min(swapA.length, swapB.length);
    for (let p = 0; p < swapPairs; p++)
      state = applySWAP(state, n, swapA[p], swapB[p]);
  }

  return qubits.map((_, idx) => partialTraceBloch(state, n, idx));
};