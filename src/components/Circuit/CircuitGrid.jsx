import React from 'react';
import './CircuitGrid.css';

// Added 'C' (Control) and 'TG' (Target) to the available gates
const AVAILABLE_GATES = [null, 'H', 'X', 'Y', 'Z', 'S', 'T', 'C', 'TG'];

const CircuitGrid = ({ qubits, circuit, onGateChange, currentStep }) => {
  const steps = 20; // Matches App.jsx MAX_STEPS
  
  // Dimensions (Must match CSS)
  const cellWidth = 40; 
  const rowHeight = 50; 
  const labelWidth = 90; // FIX: Width of the sticky label column

  // --- HELPER: Draw SVG Lines for CNOT gates ---
  const renderConnections = () => {
    const connections = [];
    const halfCell = cellWidth / 2;
    const halfRow = rowHeight / 2;

    // Iterate through each time step (column)
    for (let col = 0; col < steps; col++) {
      let controls = [];
      let targets = [];

      // Find all Controls and Targets in this specific column
      qubits.forEach((q, rowIndex) => {
        const gate = circuit[q.id]?.[col];
        if (gate === 'C') controls.push(rowIndex); 
        if (gate === 'TG') targets.push(rowIndex);
      });

      // If we have both a Control and a Target, draw a line
      if (controls.length > 0 && targets.length > 0) {
        const allIndices = [...controls, ...targets];
        const minRow = Math.min(...allIndices);
        const maxRow = Math.max(...allIndices);

        // FIX: Add labelWidth to x calculation so lines align with the wire track
        const x = labelWidth + (col * cellWidth) + halfCell;
        
        const y1 = minRow * rowHeight + halfRow;
        const y2 = maxRow * rowHeight + halfRow;

        connections.push(
          <line 
            key={`line-${col}`} 
            x1={x} y1={y1} 
            x2={x} y2={y2} 
            stroke="#007bff" 
            strokeWidth="2" 
          />
        );
      }
    }
    return connections;
  };

  // Calculate total width for the SVG so it covers the full scrollable area
  const totalGridWidth = labelWidth + (steps * cellWidth);

  return (
    <div className="circuit-container-scroll">
      <div className="circuit-header">
        <span className="header-title">Circuit Editor</span>
        <div className="time-ruler">
          {Array.from({ length: steps }).map((_, i) => (
            <div 
              key={i} 
              className={`ruler-tick ${i === currentStep - 1 ? 'active-step' : ''}`}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="circuit-body">
        {/* SVG OVERLAY FOR CONNECTIONS */}
        <svg 
            className="circuit-connections-overlay"
            style={{ width: `${totalGridWidth}px` }} /* FIX: Ensure SVG scrolls with content */
        >
          {renderConnections()}
        </svg>

        {qubits.map(qubit => (
          <div key={qubit.id} className="circuit-row">
            <div className="qubit-label-cell">
              {qubit.name}
            </div>
            
            <div className="wire-track">
              {Array.from({ length: steps }).map((_, stepIndex) => {
                const gate = circuit[qubit.id]?.[stepIndex];
                const isActive = stepIndex === currentStep - 1;
                
                // Determine styling based on gate type
                let gateClass = '';
                let gateLabel = gate;
                
                if (gate === 'C') { 
                    gateClass = 'gate-control'; 
                    gateLabel = ''; // Dot has no text
                } else if (gate === 'TG') { 
                    gateClass = 'gate-target'; 
                    gateLabel = '+'; // Target is a cross
                }

                return (
                  <div 
                    key={stepIndex} 
                    className={`gate-slot ${gate ? 'filled' : ''} ${isActive ? 'active-slot' : ''}`}
                    onClick={() => {
                        const currentIdx = AVAILABLE_GATES.indexOf(gate);
                        const nextGate = AVAILABLE_GATES[(currentIdx + 1) % AVAILABLE_GATES.length];
                        onGateChange(qubit.id, stepIndex, nextGate);
                    }}
                  >
                    <div className="wire-line"></div>
                    
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