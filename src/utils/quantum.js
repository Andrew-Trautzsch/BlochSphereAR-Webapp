import * as THREE from 'three';

// ============================================================
// LEGACY QUATERNION-BASED GATES  (sidebar single-qubit controls)
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
  Y:     createGate(AXIS.Z, Math.PI),
  Z:     createGate(AXIS.Y, Math.PI),
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

export const simulateCircuit = (startRotation, gateSequence) => {
  let rot = startRotation.clone();
  if (!gateSequence || gateSequence.length === 0) return rot;
  gateSequence.forEach(g => { if (g && GATES[g]) rot = applyGate(rot, g); });
  return rot;
};

// ============================================================
// STATE VECTOR SIMULATION
// ============================================================

const SQRT2_INV = 1 / Math.sqrt(2);

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

const quaternionToAmplitudes = (quat) => {
  const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
  const bx =  dir.x;
  const by = -dir.z;
  const bz =  dir.y;

  const ar = Math.sqrt(Math.max(0, (1 + bz) * 0.5));
  const ai = 0;
  let br, bi;
  if (ar > 1e-10) {
    br = bx / (2 * ar);
    bi = by / (2 * ar);
  } else {
    br = 1; bi = 0;
  }
  return [ar, ai, br, bi];
};

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

const applySWAP = (state, n, qubitA, qubitB) => {
  const dim = 1 << n;
  const bA  = n - 1 - qubitA;
  const bB  = n - 1 - qubitB;
  const out = new Float64Array(state.length);

  for (let k = 0; k < dim; k++) {
    const bitA = (k >> bA) & 1;
    const bitB = (k >> bB) & 1;
    if (bitA !== bitB) {
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

// ── Measurement ───────────────────────────────────────────────

/**
 * Compute the probability of measuring |0⟩ for a given qubit
 * by summing |amplitude|² over all basis states where that qubit is 0.
 */
const measurementProb0 = (state, n, qubitIdx) => {
  const dim    = 1 << n;
  const bitPos = n - 1 - qubitIdx;
  let prob0 = 0;
  for (let k = 0; k < dim; k++) {
    if (((k >> bitPos) & 1) === 0) {
      prob0 += state[k*2]*state[k*2] + state[k*2+1]*state[k*2+1];
    }
  }
  return Math.min(1, Math.max(0, prob0));
};

/**
 * Collapse the full state vector given a measurement outcome for qubitIdx.
 * outcome = 0 → zero out all amplitudes where that qubit is |1⟩
 * outcome = 1 → zero out all amplitudes where that qubit is |0⟩
 * Then renormalise.
 *
 * This correctly collapses entangled partners — because the joint state
 * vector encodes all correlations, zeroing the "wrong" branches
 * automatically updates every other qubit's reduced state.
 */
const collapseState = (state, n, qubitIdx, outcome) => {
  const dim    = 1 << n;
  const bitPos = n - 1 - qubitIdx;
  const out    = new Float64Array(state.length);
  let norm     = 0;

  for (let k = 0; k < dim; k++) {
    const bit = (k >> bitPos) & 1;
    if (bit === outcome) {
      out[k*2]   = state[k*2];
      out[k*2+1] = state[k*2+1];
      norm += state[k*2]*state[k*2] + state[k*2+1]*state[k*2+1];
    }
    // else leave as zero (Float64Array initialises to 0)
  }

  // Renormalise
  if (norm > 1e-12) {
    const invSqrtNorm = 1 / Math.sqrt(norm);
    for (let i = 0; i < out.length; i++) out[i] *= invSqrtNorm;
  }

  return out;
};

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
    rho01r += kr * k1r + ki * k1i;
    rho01i += ki * k1r - kr * k1i;
  }

  const bx =  2 * rho01r;
  const by = -2 * rho01i;
  const bz =  2 * rho00 - 1;

  const blochLen = Math.sqrt(bx*bx + by*by + bz*bz);
  const purity   = Math.min(1, blochLen);

  const dx = bx, dy = bz, dz = -by;
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  const direction = len > 1e-9
    ? new THREE.Vector3(dx/len, dy/len, dz/len)
    : new THREE.Vector3(0, 1, 0);

  return { direction, purity };
};

// ============================================================
// CIRCUIT PRESET GENERATORS
// ============================================================

export const createBellStateCircuit = ([q0Id, q1Id]) => ({
  [q0Id]: ['H', 'C'],
  [q1Id]: [null, 'TG'],
});

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

export const createTeleportationCircuit = ([q0Id, q1Id, q2Id]) => ({
  [q0Id]: [null,  null,  'C',   'H'],
  [q1Id]: ['H',   'C',   'TG',  null],
  [q2Id]: [null,  'TG',  null,  null],
});

// ============================================================
// PUBLIC SIMULATION API
// ============================================================

/**
 * simulateAllQubits
 *
 * @param {Array}   qubits            — qubit objects with .id and .rotation
 * @param {Object}  circuit           — { [qubitId]: [gate|null, …] }
 * @param {number}  maxStep           — columns to apply (0 = initial state only)
 * @param {boolean} stochastic        — if true, random collapse; if false, deterministic (higher-prob outcome)
 * @param {Object}  measurementCache  — { [qubitIdx_step]: 0|1 } — cached outcomes so stochastic results
 *                                      are stable across re-renders. Mutated in place.
 *
 * @returns {Array<{ direction, purity, measured: boolean, measurementOutcome: 0|1|null }>}
 */
export const simulateAllQubits = (
  qubits,
  circuit,
  maxStep,
  stochastic = false,
  measurementCache = {}
) => {
  const n = qubits.length;
  if (n === 0) return [];

  const ampArr = qubits.map(q => quaternionToAmplitudes(q.rotation));
  let state    = buildProductState(ampArr);

  // Track which qubits have been measured and their outcomes
  const measured        = new Array(n).fill(false);  // measured[qubitIdx]
  const measureOutcome  = new Array(n).fill(null);   // 0 | 1 | null

  for (let step = 0; step < maxStep; step++) {
    const cnotControls = [];
    const cnotTargets  = [];
    const czA          = [];
    const czB          = [];
    const swapA        = [];
    const swapB        = [];
    const measurements = []; // qubit indices to measure this step

    qubits.forEach((q, idx) => {
      const gate = circuit[q.id]?.[step];
      if (!gate) return;

      // Skip any gate on an already-measured qubit
      if (measured[idx]) return;

      switch (gate) {
        case 'M':
          measurements.push(idx);
          break;
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

    // Two-qubit gates
    const cnotPairs = Math.min(cnotControls.length, cnotTargets.length);
    for (let p = 0; p < cnotPairs; p++)
      state = applyCNOT(state, n, cnotControls[p], cnotTargets[p]);

    const czPairs = Math.min(czA.length, czB.length);
    for (let p = 0; p < czPairs; p++)
      state = applyCZ(state, n, czA[p], czB[p]);

    const swapPairs = Math.min(swapA.length, swapB.length);
    for (let p = 0; p < swapPairs; p++)
      state = applySWAP(state, n, swapA[p], swapB[p]);

    // Measurements — processed after unitary gates in same step
    for (const idx of measurements) {
      const cacheKey = `${idx}_${step}`;
      let outcome;

      if (measurementCache[cacheKey] !== undefined) {
        // Use cached result so stochastic runs stay stable across re-renders
        outcome = measurementCache[cacheKey];
      } else {
        const prob0 = measurementProb0(state, n, idx);
        if (stochastic) {
          outcome = Math.random() < prob0 ? 0 : 1;
        } else {
          // Deterministic: pick higher probability outcome (prob0 >= 0.5 → |0⟩)
          outcome = prob0 >= 0.5 ? 0 : 1;
        }
        measurementCache[cacheKey] = outcome;
      }

      // Collapse the full joint state — this automatically collapses entangled partners
      state = collapseState(state, n, idx, outcome);
      measured[idx]       = true;
      measureOutcome[idx] = outcome;
    }
  }

  // Extract per-qubit Bloch data
  return qubits.map((_, idx) => {
    const bloch = partialTraceBloch(state, n, idx);
    return {
      ...bloch,
      measured:           measured[idx],
      measurementOutcome: measureOutcome[idx],
    };
  });
};