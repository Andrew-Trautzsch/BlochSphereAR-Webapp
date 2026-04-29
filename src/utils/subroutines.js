/**
 * Subroutines (quantum subcircuits)
 *
 * A subroutine is a named, reusable block of gates that can be
 * stamped into any position in the circuit grid.
 *
 * Structure:
 * {
 *   id:          number           — unique timestamp id
 *   name:        string           — user-defined label
 *   color:       string           — CSS hex accent colour
 *   qubitCount:  number           — how many qubit rows it spans
 *   stepCount:   number           — how many time steps it occupies
 *   gates:       Array<{          — gate list (relative positions)
 *     qubitOffset: number,        —   row offset from first qubit (0-based)
 *     stepOffset:  number,        —   column offset from stamp position (0-based)
 *     gate:        string|null    —   gate token
 *   }>
 *   description: string           — auto-generated human-readable summary
 * }
 */

const PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

let _colorIdx = 0;
const nextColor = () => PALETTE[(_colorIdx++) % PALETTE.length];

/**
 * Create a subroutine from a rectangular selection of the circuit grid.
 *
 * @param {string}   name       — user-supplied name
 * @param {Array}    qubits     — ordered qubit objects (the rows in the selection)
 * @param {Object}   circuit    — { [qubitId]: [gate|null, …] }
 * @param {number}   stepStart  — first step index (inclusive, 0-based)
 * @param {number}   stepEnd    — last step index (inclusive, 0-based)
 * @returns {Object}  subroutine
 */
export function createSubroutine(name, qubits, circuit, stepStart, stepEnd) {
  const gates = [];

  qubits.forEach((q, qubitOffset) => {
    const row = circuit[q.id] ?? [];
    for (let s = stepStart; s <= stepEnd; s++) {
      const gate = row[s] ?? null;
      gates.push({ qubitOffset, stepOffset: s - stepStart, gate });
    }
  });

  const stepCount  = stepEnd - stepStart + 1;
  const qubitCount = qubits.length;

  // Build a compact description
  const gateNames = [...new Set(gates.map(g => g.gate).filter(Boolean))];
  const description = gateNames.length
    ? `${qubitCount}q × ${stepCount}t · ${gateNames.join(', ')}`
    : `${qubitCount}q × ${stepCount}t · (identity)`;

  return {
    id:          Date.now(),
    name:        name.trim() || 'Unnamed',
    color:       nextColor(),
    qubitCount,
    stepCount,
    gates,
    description,
  };
}

/**
 * Stamp a subroutine into the circuit at a given position.
 * Returns the updated circuit (does not mutate).
 *
 * @param {Object}   circuit       — existing circuit map
 * @param {Object}   subroutine    — subroutine to apply
 * @param {Array}    targetQubits  — ordered qubit objects (must have length >= subroutine.qubitCount)
 * @param {number}   stepStart     — column to stamp at (0-based)
 * @param {number}   totalSteps    — grid width (to avoid overflow)
 * @returns {Object} newCircuit
 */
export function stampSubroutine(circuit, subroutine, targetQubits, stepStart, totalSteps) {
  const newCircuit = {};

  // Clone all existing rows
  Object.keys(circuit).forEach(id => {
    newCircuit[id] = [...(circuit[id] ?? [])];
  });

  subroutine.gates.forEach(({ qubitOffset, stepOffset, gate }) => {
    const qubit = targetQubits[qubitOffset];
    if (!qubit) return;
    const col = stepStart + stepOffset;
    if (col >= totalSteps) return;

    if (!newCircuit[qubit.id]) newCircuit[qubit.id] = [];
    // Extend row if needed
    while (newCircuit[qubit.id].length <= col) newCircuit[qubit.id].push(null);
    newCircuit[qubit.id][col] = gate;
  });

  return newCircuit;
}

/**
 * Given a circuit and a placed subroutine instance, check whether
 * all its gate slots still exactly match the subroutine definition.
 * Used to detect if the user has manually edited over a block.
 */
export function subroutineIntact(circuit, instance, qubits) {
  const { subroutine, qubitIds, stepStart } = instance;
  return subroutine.gates.every(({ qubitOffset, stepOffset, gate }) => {
    const qubitId = qubitIds[qubitOffset];
    const col     = stepStart + stepOffset;
    const actual  = circuit[qubitId]?.[col] ?? null;
    return actual === gate;
  });
}

/**
 * Remove all gates belonging to a placed instance from the circuit.
 * Returns the updated circuit.
 */
export function clearSubroutineInstance(circuit, instance, qubits) {
  const { subroutine, qubitIds, stepStart } = instance;
  const newCircuit = {};
  Object.keys(circuit).forEach(id => { newCircuit[id] = [...(circuit[id] ?? [])]; });

  subroutine.gates.forEach(({ qubitOffset, stepOffset }) => {
    const qubitId = qubitIds[qubitOffset];
    const col     = stepStart + stepOffset;
    if (newCircuit[qubitId] && col < newCircuit[qubitId].length) {
      newCircuit[qubitId][col] = null;
    }
  });

  return newCircuit;
}

/**
 * Generate a unique instance id for a placed subroutine.
 */
export function makeInstanceId() {
  return `inst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}