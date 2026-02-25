import React from 'react';
import './CircuitGrid.css';

const AVAILABLE_GATES = [null, 'H', 'X', 'Y', 'Z', 'S', 'T'];

const CircuitGrid = ({ qubits, circuit, onGateChange, currentStep }) => {
  const steps = 20; // Matches App.jsx MAX_STEPS

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
        {qubits.map(qubit => (
          <div key={qubit.id} className="circuit-row">
            <div className="qubit-label-cell">
              {qubit.name}
            </div>
            
            <div className="wire-track">
              {Array.from({ length: steps }).map((_, stepIndex) => {
                const gate = circuit[qubit.id]?.[stepIndex];
                // Highlight the cell if it's the one currently being applied
                const isActive = stepIndex === currentStep - 1;
                
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
                    {gate && <div className={`gate-box gate-${gate}`}>{gate}</div>}
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