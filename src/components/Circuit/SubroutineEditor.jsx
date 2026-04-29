import React, { useState, useEffect, useRef } from 'react';
import './SubroutineEditor.css';

/**
 * Modal that appears after the user finishes a rectangular selection
 * in the circuit grid. Lets them name the subroutine and confirm.
 *
 * Props:
 *   selection   — { qubitIds, stepStart, stepEnd } | null
 *   qubits      — all qubit objects
 *   circuit     — circuit map
 *   onConfirm   — (name) => void
 *   onCancel    — () => void
 */
export default function SubroutineEditor({ selection, qubits, circuit, onConfirm, onCancel }) {
  const [name, setName]     = useState('');
  const inputRef            = useRef(null);

  useEffect(() => {
    if (selection) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [selection]);

  if (!selection) return null;

  const { qubitIds, stepStart, stepEnd } = selection;
  const selQubits  = qubitIds.map(id => qubits.find(q => q.id === id)).filter(Boolean);
  const stepCount  = stepEnd - stepStart + 1;

  // Collect gate names for preview
  const gateNames = new Set();
  selQubits.forEach(q => {
    for (let s = stepStart; s <= stepEnd; s++) {
      const g = circuit[q.id]?.[s];
      if (g) gateNames.add(g);
    }
  });

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim());
  };

  return (
    <div className="sr-backdrop" onClick={onCancel}>
      <div className="sr-modal" onClick={e => e.stopPropagation()}>

        <div className="sr-modal-header">
          <span className="sr-modal-icon">⊞</span>
          <span className="sr-modal-title">Save as Subroutine</span>
        </div>

        <div className="sr-preview-row">
          <div className="sr-preview-chip">
            <span className="sr-preview-num">{selQubits.length}</span>
            <span className="sr-preview-lbl">qubits</span>
          </div>
          <div className="sr-preview-chip">
            <span className="sr-preview-num">{stepCount}</span>
            <span className="sr-preview-lbl">steps</span>
          </div>
          <div className="sr-preview-chip">
            <span className="sr-preview-num">{gateNames.size || '—'}</span>
            <span className="sr-preview-lbl">gate types</span>
          </div>
        </div>

        {gateNames.size > 0 && (
          <div className="sr-gate-tags">
            {[...gateNames].map(g => (
              <span key={g} className="sr-gate-tag">{g}</span>
            ))}
          </div>
        )}

        <div className="sr-name-row">
          <label className="sr-label">Name</label>
          <input
            ref={inputRef}
            className="sr-input"
            placeholder="e.g. Bell Prep, QFT-2, Grover Oracle…"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') onCancel();
            }}
            maxLength={40}
          />
        </div>

        <div className="sr-actions">
          <button className="sr-btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="sr-btn-confirm"
            onClick={handleConfirm}
            disabled={!name.trim()}
          >
            Save subroutine
          </button>
        </div>
      </div>
    </div>
  );
}