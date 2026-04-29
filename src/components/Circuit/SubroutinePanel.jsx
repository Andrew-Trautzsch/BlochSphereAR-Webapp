import React, { useState } from 'react';
import './SubroutinePanel.css';

/**
 * Collapsible panel shown above the circuit grid.
 * Lists all saved subroutines; user clicks one to enter "stamp mode",
 * then clicks a cell in the circuit grid to place it.
 *
 * Props:
 *   subroutines    — Array of subroutine objects
 *   stampingId     — id of the subroutine currently being stamped (or null)
 *   onStartStamp   — (subroutineId) => void
 *   onCancelStamp  — () => void
 *   onDelete       — (subroutineId) => void
 */
export default function SubroutinePanel({
  subroutines,
  stampingId,
  onStartStamp,
  onCancelStamp,
  onDelete,
}) {
  const [open, setOpen] = useState(true);

  if (subroutines.length === 0 && !stampingId) return null;

  return (
    <div className="srp-root">
      {/* Header row */}
      <div className="srp-header" onClick={() => setOpen(o => !o)}>
        <span className="srp-title">
          <span className="srp-icon">⊞</span>
          Subroutines
          <span className="srp-count">{subroutines.length}</span>
        </span>
        <span className="srp-toggle">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="srp-body">
          {/* Stamp-mode banner */}
          {stampingId && (
            <div className="srp-stamp-banner">
              <span className="srp-stamp-dot" />
              Click any gate cell in the circuit to stamp
              <button className="srp-cancel-btn" onClick={onCancelStamp}>✕ Cancel</button>
            </div>
          )}

          {/* Subroutine cards */}
          <div className="srp-list">
            {subroutines.map(sr => {
              const isStamping = stampingId === sr.id;
              return (
                <div
                  key={sr.id}
                  className={`srp-card ${isStamping ? 'stamping' : ''}`}
                  style={{ '--sr-color': sr.color }}
                >
                  <div className="srp-card-accent" />

                  <div className="srp-card-body">
                    <div className="srp-card-name">{sr.name}</div>
                    <div className="srp-card-desc">{sr.description}</div>
                  </div>

                  <div className="srp-card-actions">
                    <button
                      className={`srp-stamp-btn ${isStamping ? 'active' : ''}`}
                      onClick={() => isStamping ? onCancelStamp() : onStartStamp(sr.id)}
                      title={isStamping ? 'Cancel stamp' : 'Stamp into circuit'}
                    >
                      {isStamping ? '✕' : '↓ Stamp'}
                    </button>
                    <button
                      className="srp-delete-btn"
                      onClick={() => onDelete(sr.id)}
                      title="Delete subroutine"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}