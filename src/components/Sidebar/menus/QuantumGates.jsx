import React from 'react';
import { applyGate } from '../../../utils/quantum';

export default function QuantumGates({ rotation, setRotation }) {
  
  const handleClick = (gateKey) => {
    const newRotation = applyGate(rotation, gateKey);
    setRotation(newRotation);
  };

  const GateButton = ({ label, gateKey }) => (
    <button onClick={() => handleClick(gateKey)}>{label}</button>
  );

  return (
    <div className="gate-menu">
      <p className="hint-text">Apply a gate to the current state.</p>
      
      <h4>Pauli Gates</h4>
      <div className="gate-button-group">
        <GateButton label="X" gateKey="X" />
        <GateButton label="Y" gateKey="Y" />
        <GateButton label="Z" gateKey="Z" />
      </div>

      <h4>Hadamard</h4>
      <div className="gate-button-group">
        <GateButton label="H" gateKey="H" />
      </div>

      <h4>Phase Gates</h4>
      <div className="gate-button-group">
        <GateButton label="S" gateKey="S" />
        <GateButton label="S†" gateKey="S_DAG" />
        <GateButton label="T" gateKey="T" />
        <GateButton label="T†" gateKey="T_DAG" />
      </div>
    </div>
  );
}