import React, { useState, useRef, useCallback } from 'react';
import SubroutinePanel from './SubroutinePanel';
import SubroutineEditor from './SubroutineEditor';
import './CircuitGrid.css';
import './SubroutinePanel.css';
import './SubroutineEditor.css';

const AVAILABLE_GATES = [
  null,
  'H', 'X', 'Y', 'Z', 'S', 'T',
  'C', 'TG',
  'CZC', 'CZT',
  'SWA', 'SWB',
  'M',
];

const TWO_QUBIT_GATES = new Set(['C', 'TG', 'CZC', 'CZT', 'SWA', 'SWB']);

const PARTNER_MAP = {
  'C': 'TG', 'TG': 'C',
  'CZC': 'CZT', 'CZT': 'CZC',
  'SWA': 'SWB', 'SWB': 'SWA',
};

// ── helpers ─────────────────────────────────────────────────────────────────

const findPartnerQubitId = (qubitId, col, gate, qubits, circuit) => {
  const partnerToken = PARTNER_MAP[gate];
  if (!partnerToken) return null;
  const partner = qubits.find(q => q.id !== qubitId && circuit[q.id]?.[col] === partnerToken);
  return partner?.id ?? null;
};

const isTopologyViolation = (qubitId, col, gate, qubits, circuit, edgeSet) => {
  if (!edgeSet || !TWO_QUBIT_GATES.has(gate)) return false;
  const partnerId = findPartnerQubitId(qubitId, col, gate, qubits, circuit);
  if (!partnerId) return false;
  return !edgeSet.has(`${qubitId}-${partnerId}`);
};

// ── main component ───────────────────────────────────────────────────────────

const CircuitGrid = ({
  qubits,
  circuit,
  onGateChange,
  currentStep,
  edgeSet,
  measuredQubits,
  // Subroutine props
  subroutines,
  subroutineInstances,
  stampingId,
  onSaveSubroutine,
  onStartStamp,
  onCancelStamp,
  onStampAt,
  onDeleteSubroutine,
  onRemoveInstance,
}) => {
  const steps      = 20;
  const cellWidth  = 40;
  const rowHeight  = 50;
  const labelWidth = 90;

  // ── Selection state (for creating subroutines) ──
  const [selMode,    setSelMode]    = useState(false);
  const [selAnchor,  setSelAnchor]  = useState(null);
  const [selCurrent, setSelCurrent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // Normalised selection bounds
  const selBounds = selAnchor && selCurrent ? {
    rowMin: Math.min(selAnchor.qubitIdx,  selCurrent.qubitIdx),
    rowMax: Math.max(selAnchor.qubitIdx,  selCurrent.qubitIdx),
    colMin: Math.min(selAnchor.stepIdx,   selCurrent.stepIdx),
    colMax: Math.max(selAnchor.stepIdx,   selCurrent.stepIdx),
  } : null;

  const inSelection = (rowIdx, colIdx) =>
    selBounds &&
    rowIdx >= selBounds.rowMin && rowIdx <= selBounds.rowMax &&
    colIdx >= selBounds.colMin && colIdx <= selBounds.colMax;

  // ── Selection handlers ──
  const handleCellMouseDown = useCallback((e, rowIdx, colIdx) => {
    if (!selMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelAnchor({ qubitIdx: rowIdx, stepIdx: colIdx });
    setSelCurrent({ qubitIdx: rowIdx, stepIdx: colIdx });
    setIsDragging(true);
  }, [selMode]);

  const handleCellMouseEnter = useCallback((rowIdx, colIdx) => {
    if (!selMode || !isDragging) return;
    setSelCurrent({ qubitIdx: rowIdx, stepIdx: colIdx });
  }, [selMode, isDragging]);

  const handleCellMouseUp = useCallback(() => {
    if (!selMode || !isDragging) return;
    setIsDragging(false);
    if (selAnchor && selCurrent) setShowEditor(true);
  }, [selMode, isDragging, selAnchor, selCurrent]);

  const handleSaveSubroutine = useCallback((name) => {
    if (!selBounds) return;
    const selectedQubits = qubits.slice(selBounds.rowMin, selBounds.rowMax + 1);
    onSaveSubroutine(name, selectedQubits, selBounds.colMin, selBounds.colMax);
    setShowEditor(false);
    setSelAnchor(null);
    setSelCurrent(null);
    setSelMode(false);
  }, [selBounds, qubits, onSaveSubroutine]);

  const handleCancelEditor = useCallback(() => {
    setShowEditor(false);
    setSelAnchor(null);
    setSelCurrent(null);
  }, []);

  const handleToggleSelMode = () => {
    setSelMode(s => !s);
    setSelAnchor(null);
    setSelCurrent(null);
    setShowEditor(false);
    if (stampingId) onCancelStamp();
  };

  // ── Stamp: clicking a cell while stampingId is set ──
  const handleCellClick = useCallback((e, rowIdx, colIdx) => {
    if (selMode) return;

    if (stampingId) {
      e.stopPropagation();
      onStampAt(rowIdx, colIdx);
      return;
    }

    const qubit = qubits[rowIdx];
    if (!qubit) return;

    const measureStep = (() => {
      const row = circuit[qubit.id] || [];
      for (let i = 0; i < row.length; i++) if (row[i] === 'M') return i;
      return null;
    })();
    if (measureStep !== null && colIdx > measureStep) return;

    const gate       = circuit[qubit.id]?.[colIdx] ?? null;
    const currentIdx = AVAILABLE_GATES.indexOf(gate);
    const nextGate   = AVAILABLE_GATES[(currentIdx + 1) % AVAILABLE_GATES.length];
    onGateChange(qubit.id, colIdx, nextGate);
  }, [selMode, stampingId, qubits, circuit, onGateChange, onStampAt]);

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

      const cnotViolation = edgeSet && cnotCtrl.length > 0 && cnotTgt.length > 0 &&
        !edgeSet.has(`${qubits[cnotCtrl[0]]?.id}-${qubits[cnotTgt[0]]?.id}`);
      const czViolation   = edgeSet && czA.length > 0 && czB.length > 0 &&
        !edgeSet.has(`${qubits[czA[0]]?.id}-${qubits[czB[0]]?.id}`);
      const swapViolation = edgeSet && swapA.length > 0 && swapB.length > 0 &&
        !edgeSet.has(`${qubits[swapA[0]]?.id}-${qubits[swapB[0]]?.id}`);

      if (cnotCtrl.length > 0 && cnotTgt.length > 0) {
        const all = [...cnotCtrl, ...cnotTgt];
        lines.push(<line key={`cnot-${col}`}
          x1={x} y1={Math.min(...all) * rowHeight + halfRow}
          x2={x} y2={Math.max(...all) * rowHeight + halfRow}
          stroke={cnotViolation ? '#cc4444' : '#007bff'} strokeWidth="2" />);
      }
      if (czA.length > 0 && czB.length > 0) {
        const all = [...czA, ...czB];
        lines.push(<line key={`cz-${col}`}
          x1={x} y1={Math.min(...all) * rowHeight + halfRow}
          x2={x} y2={Math.max(...all) * rowHeight + halfRow}
          stroke={czViolation ? '#cc4444' : '#9c27b0'} strokeWidth="2" />);
      }
      if (swapA.length > 0 && swapB.length > 0) {
        const all = [...swapA, ...swapB];
        lines.push(<line key={`swap-${col}`}
          x1={x} y1={Math.min(...all) * rowHeight + halfRow}
          x2={x} y2={Math.max(...all) * rowHeight + halfRow}
          stroke={swapViolation ? '#cc4444' : '#009688'} strokeWidth="2" />);
      }
    }
    return lines;
  };

  // ── Subroutine overlay blocks (SVG) ──
  const renderSubroutineOverlays = () => {
    if (!subroutineInstances || subroutineInstances.length === 0) return null;

    return subroutineInstances.map(instance => {
      const { id, subroutine, qubitIds, stepStart } = instance;
      const rowMin = qubits.findIndex(q => q.id === qubitIds[0]);
      if (rowMin < 0) return null;

      const x      = labelWidth + stepStart * cellWidth + 2;
      const y      = rowMin * rowHeight + 2;
      const width  = subroutine.stepCount * cellWidth - 4;
      const height = subroutine.qubitCount * rowHeight - 4;
      const color  = subroutine.color;

      return (
        <g key={id} className="sr-overlay-group">
          <rect
            x={x} y={y} width={width} height={height}
            rx={5} ry={5}
            fill={`${color}14`}
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="5 3"
            strokeOpacity="0.7"
          />
          <text
            x={x + 7} y={y + 14}
            fill={color}
            fontSize="10"
            fontFamily="'JetBrains Mono', 'Fira Code', monospace"
            fontWeight="600"
            opacity="0.9"
          >
            {subroutine.name}
          </text>
          <g
            className="sr-overlay-remove"
            style={{ cursor: 'pointer' }}
            onClick={() => onRemoveInstance(id)}
          >
            <rect
              x={x + width - 17} y={y + 2}
              width={15} height={15}
              rx={3}
              fill="#1a0a0a"
              stroke="#441a1a"
              strokeWidth="1"
            />
            <text
              x={x + width - 9} y={y + 12}
              fill="#cc4444"
              fontSize="9"
              textAnchor="middle"
              fontFamily="monospace"
              style={{ pointerEvents: 'none' }}
            >×</text>
          </g>
        </g>
      );
    });
  };

  // ── Selection overlay (SVG) ──
  const renderSelectionOverlay = () => {
    if (!selBounds) return null;
    const x      = labelWidth + selBounds.colMin * cellWidth + 1;
    const y      = selBounds.rowMin * rowHeight + 1;
    const width  = (selBounds.colMax - selBounds.colMin + 1) * cellWidth - 2;
    const height = (selBounds.rowMax - selBounds.rowMin + 1) * rowHeight - 2;
    return (
      <rect
        x={x} y={y} width={width} height={height}
        rx={4} ry={4}
        fill="rgba(59,130,246,0.08)"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeDasharray="4 2"
        className="sr-selection-rect"
      />
    );
  };

  // ── Stamp ghost label ──
  const renderStampGhost = () => {
    if (!stampingId) return null;
    const sr = subroutines?.find(s => s.id === stampingId);
    if (!sr) return null;
    return (
      <text
        x={labelWidth + 6} y={20}
        fill="#3b82f6"
        fontSize="10"
        fontFamily="'JetBrains Mono', 'Fira Code', monospace"
        opacity="0.7"
      >
        ↓ Click a cell to stamp "{sr.name}"
      </text>
    );
  };

  const totalGridWidth = labelWidth + steps * cellWidth;

  const bodyCursor = selMode
    ? (isDragging ? 'crosshair' : 'cell')
    : stampingId
    ? 'copy'
    : 'default';

  return (
    <div className="circuit-container-scroll">

      {/* Subroutine library panel */}
      <SubroutinePanel
        subroutines={subroutines ?? []}
        stampingId={stampingId}
        onStartStamp={onStartStamp}
        onCancelStamp={onCancelStamp}
        onDelete={onDeleteSubroutine}
      />

      {/* ── Subroutine toolbar — sits above ruler, never disrupts alignment ── */}
      <div className="circuit-subbar">
        <button
          className={`sr-select-mode-btn ${selMode ? 'active' : ''}`}
          onClick={handleToggleSelMode}
          title={selMode ? 'Exit selection mode' : 'Select gates to create a subroutine'}
        >
          {selMode ? '✕ Cancel selection' : '⊞ New subroutine'}
        </button>
      </div>

      {/* ── Header row: fixed-width title cell + ruler ticks, perfectly aligned ── */}
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
      <div
        className="circuit-body"
        style={{ cursor: bodyCursor }}
        onMouseUp={handleCellMouseUp}
      >
        <svg
          className="circuit-connections-overlay"
          style={{ width: `${totalGridWidth}px` }}
        >
          {renderConnections()}
          {renderSubroutineOverlays()}
          {renderSelectionOverlay()}
          {renderStampGhost()}
        </svg>

        {qubits.map((qubit, rowIdx) => {
          const measureStep = (() => {
            const row = circuit[qubit.id] || [];
            for (let i = 0; i < row.length; i++) if (row[i] === 'M') return i;
            return null;
          })();
          const measuredInfo = measuredQubits?.[qubit.id];

          return (
            <div key={qubit.id} className="circuit-row">
              <div className="qubit-label-cell">
                {qubit.name}
                {measuredInfo && currentStep > measuredInfo.step && (
                  <span className={`measured-badge measured-${measuredInfo.outcome}`}>
                    {measuredInfo.outcome === 0 ? '|0⟩' : '|1⟩'}
                  </span>
                )}
              </div>

              <div className="wire-track">
                {Array.from({ length: steps }).map((_, stepIndex) => {
                  const gate          = circuit[qubit.id]?.[stepIndex];
                  const isActive      = stepIndex === currentStep - 1;
                  const violation     = gate
                    ? isTopologyViolation(qubit.id, stepIndex, gate, qubits, circuit, edgeSet)
                    : false;
                  const isPostMeasure = measureStep !== null && stepIndex > measureStep;
                  const isInSel       = inSelection(rowIdx, stepIndex);
                  const isStampMode   = !!stampingId;

                  let gateClass = '';
                  let gateLabel = gate ?? '';

                  switch (gate) {
                    case 'C':   gateClass = 'gate-control';    gateLabel = '';  break;
                    case 'TG':  gateClass = 'gate-target';     gateLabel = '+'; break;
                    case 'CZC': gateClass = 'gate-cz-control'; gateLabel = '';  break;
                    case 'CZT': gateClass = 'gate-cz-target';  gateLabel = 'Z'; break;
                    case 'SWA':
                    case 'SWB': gateClass = 'gate-swap';       gateLabel = '×'; break;
                    case 'M':   gateClass = 'gate-measure';    gateLabel = 'M'; break;
                    default: break;
                  }

                  return (
                    <div
                      key={stepIndex}
                      className={[
                        'gate-slot',
                        gate          ? 'filled'      : '',
                        isActive      ? 'active-slot'  : '',
                        isPostMeasure ? 'post-measure' : '',
                        isInSel       ? 'in-selection' : '',
                        isStampMode   ? 'stamp-mode'   : '',
                      ].join(' ').trim()}
                      title={
                        violation       ? '⚠ No topology edge between these qubits'
                        : isPostMeasure ? 'Qubit has been measured — no further gates'
                        : selMode       ? 'Drag to select a region'
                        : isStampMode   ? 'Click to stamp here'
                        : undefined
                      }
                      onMouseDown={e => handleCellMouseDown(e, rowIdx, stepIndex)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, stepIndex)}
                      onClick={e => handleCellClick(e, rowIdx, stepIndex)}
                    >
                      <div className={`wire-line ${isPostMeasure ? 'wire-measured' : ''}`} />
                      {gate && (
                        <div className={`gate-box ${gateClass} gate-${gate} ${violation ? 'topo-violation' : ''}`}>
                          {gateLabel}
                          {violation && <span className="violation-dot" />}
                        </div>
                      )}
                      {isPostMeasure && !gate && <div className="post-measure-fill" />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {qubits.length === 0 && (
          <div className="empty-message">No Qubits. Add one from the Sidebar.</div>
        )}
      </div>

      {/* Subroutine naming modal */}
      <SubroutineEditor
        selection={
          showEditor && selBounds
            ? {
                qubitIds:  qubits.slice(selBounds.rowMin, selBounds.rowMax + 1).map(q => q.id),
                stepStart: selBounds.colMin,
                stepEnd:   selBounds.colMax,
              }
            : null
        }
        qubits={qubits}
        circuit={circuit}
        onConfirm={handleSaveSubroutine}
        onCancel={handleCancelEditor}
      />
    </div>
  );
};

export default CircuitGrid;