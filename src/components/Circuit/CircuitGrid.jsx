import React from 'react';
import './CircuitGrid.css';

// Cycle order when clicking a gate slot
const AVAILABLE_GATES = [
  null,
  'H', 'X', 'Y', 'Z', 'S', 'T',
  'C', 'TG',           // CNOT: control + target
  'CZC', 'CZT',        // CZ:   both halves (symmetric)
  'SWA', 'SWB',        // SWAP: both halves (symmetric)
];

const CircuitGrid = ({ qubits, circuit, onGateChange, currentStep }) => {
  const steps      = 20;   // matches App.jsx MAX_STEPS
  const cellWidth  = 40;
  const rowHeight  = 50;
  const labelWidth = 90;

  // ── SVG connection lines for two-qubit gates ───────────────────
  const renderConnections = () => {
    const lines = [];
    const halfCell = cellWidth / 2;
    const halfRow  = rowHeight / 2;

    for (let col = 0; col < steps; col++) {
      const cnotCtrl = [], cnotTgt = [];
      const czA      = [], czB    = [];
      const swapA    = [], swapB  = [];

      qubits.forEach((q, rowIndex) => {
        const gate = circuit[q.id]?.[col];
        if (gate === 'C')   cnotCtrl.push(rowIndex);
        if (gate === 'TG')  cnotTgt.push(rowIndex);
        if (gate === 'CZC') czA.push(rowIndex);
        if (gate === 'CZT') czB.push(rowIndex);
        if (gate === 'SWA') swapA.push(rowIndex);
        if (gate === 'SWB') swapB.push(rowIndex);
      });

      const x = labelWidth + col * cellWidth + halfCell;

      // CNOT — blue
      if (cnotCtrl.length > 0 && cnotTgt.length > 0) {
        const all = [...cnotCtrl, ...cnotTgt];
        lines.push(
          <line key={`cnot-${col}`}
            x1={x} y1={Math.min(...all) * rowHeight + halfRow}
            x2={x} y2={Math.max(...all) * rowHeight + halfRow}
            stroke="#007bff" strokeWidth="2"
          />
        );
      }

      // CZ — purple
      if (czA.length > 0 && czB.length > 0) {
        const all = [...czA, ...czB];
        lines.push(
          <line key={`cz-${col}`}
            x1={x} y1={Math.min(...all) * rowHeight + halfRow}
            x2={x} y2={Math.max(...all) * rowHeight + halfRow}
            stroke="#9c27b0" strokeWidth="2"
          />
        );
      }

      // SWAP — teal
      if (swapA.length > 0 && swapB.length > 0) {
        const all = [...swapA, ...swapB];
        lines.push(
          <line key={`swap-${col}`}
            x1={x} y1={Math.min(...all) * rowHeight + halfRow}
            x2={x} y2={Math.max(...all) * rowHeight + halfRow}
            stroke="#009688" strokeWidth="2"
          />
        );
      }
    }
    return lines;
  };

  const totalGridWidth = labelWidth + steps * cellWidth;

  return (
    <div className="circuit-container-scroll">

      {/* ── Header row ── */}
      <div className="circuit-header">
        <span className="header-title">Circuit Editor</span>
        <div className="time-ruler">
          {Array.from({ length: steps }).map((_, i) => (
            <div key={i} className={`ruler-tick ${i === currentStep - 1 ? 'active-step' : ''}`}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="circuit-body">

        {/* SVG overlay for two-qubit connection lines */}
        <svg
          className="circuit-connections-overlay"
          style={{ width: `${totalGridWidth}px` }}
        >
          {renderConnections()}
        </svg>

        {qubits.map(qubit => (
          <div key={qubit.id} className="circuit-row">
            <div className="qubit-label-cell">{qubit.name}</div>

            <div className="wire-track">
              {Array.from({ length: steps }).map((_, stepIndex) => {
                const gate     = circuit[qubit.id]?.[stepIndex];
                const isActive = stepIndex === currentStep - 1;

                // Derive display properties for each gate token
                let gateClass = '';
                let gateLabel = gate ?? '';

                switch (gate) {
                  case 'C':
                    gateClass = 'gate-control';
                    gateLabel = '';
                    break;
                  case 'TG':
                    gateClass = 'gate-target';
                    gateLabel = '+';
                    break;
                  case 'CZC':
                    gateClass = 'gate-cz-control';
                    gateLabel = '';
                    break;
                  case 'CZT':
                    gateClass = 'gate-cz-target';
                    gateLabel = 'Z';
                    break;
                  case 'SWA':
                  case 'SWB':
                    gateClass = 'gate-swap';
                    gateLabel = '×';
                    break;
                  default:
                    break;
                }

                return (
                  <div
                    key={stepIndex}
                    className={`gate-slot ${gate ? 'filled' : ''} ${isActive ? 'active-slot' : ''}`}
                    onClick={() => {
                      const currentIdx = AVAILABLE_GATES.indexOf(gate ?? null);
                      const nextGate   = AVAILABLE_GATES[(currentIdx + 1) % AVAILABLE_GATES.length];
                      onGateChange(qubit.id, stepIndex, nextGate);
                    }}
                  >
                    <div className="wire-line" />

                    {gate && (
                      <div className={`gate-box ${gateClass} gate-${gate}`}>
                        {gateLabel}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {qubits.length === 0 && (
          <div className="empty-message">No Qubits. Add one from the Sidebar.</div>
        )}
      </div>
    </div>
  );
};

export default CircuitGrid;