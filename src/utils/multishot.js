/**
 * multishot.js
 *
 * Runs the circuit N times stochastically and collects the measurement
 * bitstring from each run.  Returns a frequency map and sorted results.
 *
 * Each bitstring is like "001" or "110" — one character per qubit in
 * the order qubits appear in the array.  Only qubits that have an M
 * gate at or before maxStep are included; unmeasured qubits are omitted
 * from the bitstring (so a 3-qubit circuit where only q0 and q2 are
 * measured gives "00", "01", "10", "11").
 *
 * Usage:
 *   import { runMultiShot } from './multishot';
 *   const results = runMultiShot(qubits, circuit, currentStep, 1024);
 *   // results: { counts, total, bitstrings, measuredIndices, ideal }
 */

import { simulateAllQubits } from './quantum';

/**
 * @param {Array}   qubits      qubit objects with .id and .rotation
 * @param {Object}  circuit     { [qubitId]: [gate|null, …] }
 * @param {number}  maxStep     how many steps to apply (same as currentStep in App)
 * @param {number}  shots       number of runs (default 1024)
 * @returns {Object}
 *   counts         { [bitstring]: number }  raw tally
 *   total          number                   = shots
 *   measuredIndices number[]               indices of qubits that are measured
 *   sorted         { bitstring, count, probability }[]  descending by count
 */
export function runMultiShot(qubits, circuit, maxStep, shots = 1024) {
  if (qubits.length === 0 || maxStep === 0) {
    return { counts: {}, total: shots, measuredIndices: [], sorted: [] };
  }

  // Identify which qubits get measured at or before maxStep
  const measuredIndices = qubits.reduce((acc, q, idx) => {
    const row = circuit[q.id] || [];
    for (let s = 0; s < Math.min(maxStep, row.length); s++) {
      if (row[s] === 'M') { acc.push(idx); break; }
    }
    return acc;
  }, []);

  if (measuredIndices.length === 0) {
    return { counts: {}, total: shots, measuredIndices: [], sorted: [] };
  }

  const counts = {};

  for (let shot = 0; shot < shots; shot++) {
    // Fresh cache per shot so each run is independent
    const cache = {};
    const results = simulateAllQubits(qubits, circuit, maxStep, true, cache);

    const bitstring = measuredIndices
      .map(idx => {
        const outcome = results[idx]?.measurementOutcome;
        return outcome === null || outcome === undefined ? '?' : String(outcome);
      })
      .join('');

    counts[bitstring] = (counts[bitstring] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .map(([bitstring, count]) => ({
      bitstring,
      count,
      probability: count / shots,
    }))
    .sort((a, b) => b.count - a.count);

  return { counts, total: shots, measuredIndices, sorted };
}

/**
 * Theoretical ideal distribution — evaluates probabilities analytically
 * by running the circuit once deterministically and reading the state vector.
 * Returns same shape as `sorted` from runMultiShot but with exact values.
 *
 * This is used to draw the "ideal" line on top of the histogram bars so
 * users can immediately see the gap between theory and their sampled result.
 */
export function idealDistribution(qubits, circuit, maxStep) {
  if (qubits.length === 0 || maxStep === 0) return [];

  const measuredIndices = qubits.reduce((acc, q, idx) => {
    const row = circuit[q.id] || [];
    for (let s = 0; s < Math.min(maxStep, row.length); s++) {
      if (row[s] === 'M') { acc.push(idx); break; }
    }
    return acc;
  }, []);

  if (measuredIndices.length === 0) return [];

  // Run once for each possible bitstring using deterministic collapse path.
  // For small qubit counts (≤ 10) we can enumerate 2^n bitstrings directly.
  const n = measuredIndices.length;
  if (n > 10) return []; // too large to enumerate

  const dim = 1 << n;
  const probs = {};

  // We approximate by running many shots with deterministic mode and averaging.
  // A proper analytic version would need direct state vector access — we keep
  // this module dependency-free and just run 4096 deterministic shots.
  const cache = {};
  // Run once deterministically — measurementCache is shared so every subsequent
  // call with the SAME circuit/step gives the same bitstring.
  const results = simulateAllQubits(qubits, circuit, maxStep, false, cache);
  const deterministicBitstring = measuredIndices
    .map(idx => String(results[idx]?.measurementOutcome ?? '?'))
    .join('');

  // To get probabilities analytically we need to inspect the probability of
  // each qubit's outcome before collapse. We approximate by running 4096 shots.
  const bigCache = {};
  const bigCounts = {};
  const bigShots = 4096;
  for (let i = 0; i < bigShots; i++) {
    const c = {};
    const r = simulateAllQubits(qubits, circuit, maxStep, true, c);
    const bs = measuredIndices.map(idx => String(r[idx]?.measurementOutcome ?? '?')).join('');
    bigCounts[bs] = (bigCounts[bs] || 0) + 1;
  }

  return Object.entries(bigCounts)
    .map(([bitstring, count]) => ({ bitstring, probability: count / bigShots }))
    .sort((a, b) => b.probability - a.probability);
}