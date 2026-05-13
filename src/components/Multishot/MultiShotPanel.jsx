import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { runMultiShot } from '../../utils/multishot';
import './MultiShotPanel.css';

const SHOT_OPTIONS = [128, 512, 1024, 4096, 8192];

export default function MultiShotPanel({ qubits, circuit, currentStep }) {
  const [shots, setShots]         = useState(1024);
  const [results, setResults]     = useState(null);
  const [running, setRunning]     = useState(false);
  const [sortBy, setSortBy]       = useState('count'); // 'count' | 'bitstring'
  const [filterThreshold, setFilterThreshold] = useState(0);
  const workerRef                 = useRef(null);

  const hasMeasurements = useMemo(() => {
    if (!qubits || qubits.length === 0) return false;
    return qubits.some(q => {
      const row = circuit[q.id] || [];
      return row.slice(0, currentStep).includes('M');
    });
  }, [qubits, circuit, currentStep]);

  const handleRun = useCallback(() => {
    if (!hasMeasurements || running) return;
    setRunning(true);
    setResults(null);

    // Run in a setTimeout to let the UI show "Running…" before blocking
    setTimeout(() => {
      const r = runMultiShot(qubits, circuit, currentStep, shots);
      setResults(r);
      setRunning(false);
    }, 20);
  }, [qubits, circuit, currentStep, shots, hasMeasurements, running]);

  const sorted = useMemo(() => {
    if (!results) return [];
    const list = [...results.sorted];
    if (sortBy === 'bitstring') {
      list.sort((a, b) => a.bitstring.localeCompare(b.bitstring));
    }
    return list.filter(r => r.count / results.total >= filterThreshold / 100);
  }, [results, sortBy, filterThreshold]);

  const maxCount = useMemo(() => {
    if (!results || results.sorted.length === 0) return 1;
    return results.sorted[0].count;
  }, [results]);

  const measuredQubitNames = useMemo(() => {
    if (!results || results.measuredIndices.length === 0) return [];
    return results.measuredIndices.map(i => qubits[i]?.name ?? `q${i}`);
  }, [results, qubits]);

  // Entropy of the distribution — 0 = deterministic, log2(n) = uniform
  const entropy = useMemo(() => {
    if (!results || results.sorted.length === 0) return null;
    let h = 0;
    results.sorted.forEach(({ probability: p }) => {
      if (p > 0) h -= p * Math.log2(p);
    });
    return h.toFixed(3);
  }, [results]);

  return (
    <div className="msp-root">
      {/* ── Controls ── */}
      <div className="msp-controls">
        <span className="msp-label">Shots</span>
        <div className="msp-shot-pills">
          {SHOT_OPTIONS.map(n => (
            <button
              key={n}
              className={`msp-pill ${shots === n ? 'active' : ''}`}
              onClick={() => setShots(n)}
            >
              {n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
        </div>

        <button
          className={`msp-run-btn ${running ? 'running' : ''}`}
          onClick={handleRun}
          disabled={running || !hasMeasurements || currentStep === 0}
          title={!hasMeasurements ? 'Add an M gate to at least one qubit first' : ''}
        >
          {running ? (
            <>
              <span className="msp-spinner" />
              Running…
            </>
          ) : (
            <>
              <span className="msp-run-icon">▶</span>
              Run
            </>
          )}
        </button>

        {results && (
          <>
            <div className="msp-divider" />
            <span className="msp-label">Sort</span>
            <button
              className={`msp-pill ${sortBy === 'count' ? 'active' : ''}`}
              onClick={() => setSortBy('count')}
            >
              Frequency
            </button>
            <button
              className={`msp-pill ${sortBy === 'bitstring' ? 'active' : ''}`}
              onClick={() => setSortBy('bitstring')}
            >
              Bitstring
            </button>

            <div className="msp-divider" />
            <span className="msp-label">
              Hide &lt; {filterThreshold}%
            </span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={filterThreshold}
              onChange={e => setFilterThreshold(Number(e.target.value))}
              className="msp-threshold-slider"
            />
          </>
        )}
      </div>

      {/* ── No measurements hint ── */}
      {!hasMeasurements && (
        <div className="msp-empty">
          <span className="msp-empty-icon">⊟</span>
          <span>Add an <code>M</code> gate to one or more qubits in the circuit, then run.</span>
        </div>
      )}

      {/* ── Pre-run hint ── */}
      {hasMeasurements && !results && !running && (
        <div className="msp-empty">
          <span className="msp-empty-icon">◈</span>
          <span>Click <strong>Run</strong> to sample {shots.toLocaleString()} shots and see the outcome distribution.</span>
        </div>
      )}

      {/* ── Results ── */}
      {results && (
        <div className="msp-results">

          {/* Stats row */}
          <div className="msp-stats">
            <div className="msp-stat">
              <span className="msp-stat-val">{results.total.toLocaleString()}</span>
              <span className="msp-stat-lbl">shots</span>
            </div>
            <div className="msp-stat">
              <span className="msp-stat-val">{results.sorted.length}</span>
              <span className="msp-stat-lbl">unique outcomes</span>
            </div>
            <div className="msp-stat">
              <span className="msp-stat-val">{entropy}</span>
              <span className="msp-stat-lbl">bits entropy</span>
            </div>
            <div className="msp-stat">
              <span className="msp-stat-val">{(results.sorted[0]?.probability * 100).toFixed(1)}%</span>
              <span className="msp-stat-lbl">top outcome</span>
            </div>
          </div>

          {/* Qubit header */}
          <div className="msp-qubit-header">
            {measuredQubitNames.map((name, i) => (
              <span key={i} className="msp-qubit-tag">{name}</span>
            ))}
          </div>

          {/* Histogram */}
          <div className="msp-histogram">
            {sorted.map(({ bitstring, count, probability }) => {
              const pct = (count / maxCount) * 100;
              const isHigh = probability > 0.45;
              const isUnexpected = probability < 0.02 && probability > 0;
              return (
                <div key={bitstring} className={`msp-bar-row ${isUnexpected ? 'unexpected' : ''}`}>
                  <span className="msp-bar-label">{bitstring}</span>
                  <div className="msp-bar-track">
                    <div
                      className={`msp-bar-fill ${isHigh ? 'high' : ''} ${isUnexpected ? 'warn' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="msp-bar-count">{count}</span>
                  <span className="msp-bar-pct">{(probability * 100).toFixed(1)}%</span>
                  {isUnexpected && (
                    <span className="msp-warn-badge" title="Very low probability outcome — may indicate a bug">⚠</span>
                  )}
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="msp-filtered-msg">
                All outcomes filtered out — lower the threshold.
              </div>
            )}
          </div>

          {/* Ideal Bell hint if 2 qubits are measured */}
          {measuredQubitNames.length === 2 && results.sorted.length <= 2 && (
            <div className="msp-insight">
              <span className="msp-insight-icon">◈</span>
              {results.sorted.every(r => r.bitstring === '00' || r.bitstring === '11')
                ? `Only |00⟩ and |11⟩ detected — consistent with a Bell state. Expected ~50% each; got ${(results.sorted.find(r => r.bitstring === '00')?.probability * 100 ?? 0).toFixed(1)}% / ${(results.sorted.find(r => r.bitstring === '11')?.probability * 100 ?? 0).toFixed(1)}%.`
                : `Both |01⟩ / |10⟩ outcomes appeared — unexpected for a Bell state. Check your circuit for gate errors.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}