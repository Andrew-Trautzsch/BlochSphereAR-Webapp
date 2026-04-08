import React from 'react';
import './CircuitGrid.css';

const AVAILABLE_GATES = [
  null,
  'H', 'X', 'Y', 'Z', 'S', 'T',
  'C', 'TG',
  'CZC', 'CZT',
  'SWA', 'SWB',
];

// Two-qubit gate tokens
const TWO_QUBIT_GATES = new Set(['C', 'TG', 'CZC', 'CZT', 'SWA', 'SWB']);

// Partner token map
const PARTNER_MAP = {
  'C': 'TG', 'TG': 'C',
  'CZC': 'CZT', 'CZT': 'CZC',
  'SWA': 'SWB', 'SWB': 'SWA',
};

const CircuitGrid = ({ qubits, circuit, onGateChange, currentStep, edgeSet }) => {
  const steps      = 20;
  const cellWidth  = 40;
  const rowHeight  = 50;
  const labelWidth = 90;

  // For a given two-qubit gate at (qubitId, col), find the partner qubit id
  const findPartnerQubitId = (qubitId, col, gate) => {
    const partnerToken = PARTNER_MAP[gate];
    if (!partnerToken) return null;
    const partner = qubits.find(q => q.id !== qubitId && circuit[q.id]?.[col] === partnerToken);
    return partner?.id ?? null;
  };

  // Check if a two-qubit gate placement is invalid given the topology
  const isTopologyViolation = (qubitId, col, gate) => {
    if (!edgeSet) return false; // No topology defined → no constraints
    if (!TWO_QUBIT_GATES.has(gate)) return false;
    const partnerId = findPartnerQubitId(qubitId, col, gate);
    if (!partnerId) return false; // Partner not yet placed, don't warn yet
    return !edgeSet.has(`${qubitId}-${partnerId}`);
  };

  // ── SVG connection lines ──
  const renderConnections = () => {
    const lines = [];
    const halfCell = cellWidth / 2;
    const halfRow  = rowHeight / 2;

    for (let col = 0; col < steps; col++) {
      const cnotCtrl = [], cnotTgt = [];
      const czA = [],      czB    = [];
      const swapA = [],    swapB  = [];

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

      // Check topology violation for this column's pairs
      const cnotViolation = edgeSet && cnotCtrl.length > 0 && cnotTgt.length > 0 &&
        !edgeSet.has(`${qubits[cnotCtrl[0]]?.id}-${qubits[cnotTgt[0]]?.id}`);
      const czViolation = edgeSet && czA.length > 0 && czB.length > 0 &&
        !edgeSet.has(`${qubits[czA[0]]?.id}-${qubits[czB[0]]?.id}`);
      const swapViolation = edgeSet && swapA.length > 0 && swapB.length > 0 &&
        !edgeSet.has(`${qubits[swapA[0]]?.id}-${qubits[swapB[0]]?.id}`);

      if (cnotCtrl.length > 0 && cnotTgt.length > 0) {
        const all = [...cnotCtrl, ...cnotTgt];
        lines.push(
          <line key={`cnot-${col}`}
            x1={x} y1={Math.min(...all) * rowHeight + halfRow}
            x2={x} y2={Math.max(...all) * rowHeight + halfRow}
            stroke={cnotViolation ? '#cc4444' : '#007bff'} strokeWidth="2"
          />
        );
      }

      if (czA.length > 0 && czB.length > 0) {
        const all = [...czA, ...czB];
        lines.push(
          <line key={`cz-${col}`}
            x1={x} y1={Math.min(...all) * rowHeight + halfRow}
            x2={x} y2={Math.max(...all) * rowHeight + halfRow}
            stroke={czViolation ? '#cc4444' : '#9c27b0'} strokeWidth="2"
          />
        );
      }

      if (swapA.length > 0 && swapB.length > 0) {
        const all = [...swapA, ...swapB];
        lines.push(
          <line key={`swap-${col}`}
            x1={x} y1={Math.min(...all) * rowHeight + halfRow}
            x2={x} y2={Math.max(...all) * rowHeight + halfRow}
            stroke={swapViolation ? '#cc4444' : '#009688'} strokeWidth="2"
          />
        );
      }
    }
    return lines;
  };

  const totalGridWidth = labelWidth + steps * cellWidth;

  return (
    <div className="circuit-container-scroll">

      {/* Header */}
      <div className="circuit-header">
        <span className="header-title">
          Circuit Editor
          {edgeSet && (
            <span className="topo-active-badge" title="Topology constraints active">⬡</span>
          )}
        </span>
        <div className="time-ruler">
          {Array.from({ length: steps }).map((_, i) => (
            <div key={i} className={`ruler-tick ${i === currentStep - 1 ? 'active-step' : ''}`}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="circuit-body">
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
                const violation = gate ? isTopologyViolation(qubit.id, stepIndex, gate) : false;

                let gateClass = '';
                let gateLabel = gate ?? '';

                switch (gate) {
                  case 'C':
                    gateClass = 'gate-control'; gateLabel = ''; break;
                  case 'TG':
                    gateClass = 'gate-target';  gateLabel = '+'; break;
                  case 'CZC':
                    gateClass = 'gate-cz-control'; gateLabel = ''; break;
                  case 'CZT':
                    gateClass = 'gate-cz-target';  gateLabel = 'Z'; break;
                  case 'SWA': case 'SWB':
                    gateClass = 'gate-swap'; gateLabel = '×'; break;
                  default: break;
                }

                return (
                  <div
                    key={stepIndex}
                    className={`gate-slot ${gate ? 'filled' : ''} ${isActive ? 'active-slot' : ''}`}
                    title={violation ? '⚠ No topology edge between these qubits' : undefined}
                    onClick={() => {
                      const currentIdx = AVAILABLE_GATES.indexOf(gate ?? null);
                      const nextGate   = AVAILABLE_GATES[(currentIdx + 1) % AVAILABLE_GATES.length];
                      onGateChange(qubit.id, stepIndex, nextGate);
                    }}
                  >
                    <div className="wire-line" />
                    {gate && (
                      <div className={`gate-box ${gateClass} gate-${gate} ${violation ? 'topo-violation' : ''}`}>
                        {gateLabel}
                        {violation && <span className="violation-dot" />}
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