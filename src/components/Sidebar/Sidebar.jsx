import React, { useState } from 'react';
import Accordion from '../UI/Accordion';
import DefaultRotation from './menus/DefaultRotation';
import CustomRotation from './menus/CustomRotation';
import QuantumGates from './menus/QuantumGates';
import './Sidebar.css';

export default function Sidebar({ qubits, selectedQubit, onSelect, onAdd, onUpdate }) {
  const [activeMenu, setActiveMenu] = useState('default');

  const toggleMenu = (menu) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  // --- MODE A: REGISTRY LIST (No Qubit Selected) ---
  if (!selectedQubit) {
    return (
      <aside className="side-menu">
        <div className="manager-header">
          <h2>Qubit Register</h2>
          <button onClick={onAdd} className="add-btn">+</button>
        </div>
        <ul className="qubit-list">
          {qubits.map(q => (
            <li key={q.id} onClick={() => onSelect(q.id)}>
              <span className="status-dot"></span>
              {q.name}
            </li>
          ))}
        </ul>
        <p className="hint-text">Select a qubit to edit properties or move it.</p>
      </aside>
    );
  }

  // --- MODE B: INSPECTOR (Qubit Selected) ---
  const handlePosChange = (index, value) => {
    const newPos = [...selectedQubit.position];
    newPos[index] = parseFloat(value) || 0;
    onUpdate(selectedQubit.id, { position: newPos });
  };

  return (
    <aside className="side-menu">
      <button className="back-btn" onClick={() => onSelect(null)}>
        ← Back to Register
      </button>

      <div className="inspector-header">
        <h2>{selectedQubit.name}</h2>
      </div>

      {/* 1. LOCATION CONTROLS */}
      <div className="location-panel">
        <label>Position (X, Y, Z)</label>
        <div className="xyz-inputs">
          <input 
            type="number" step="0.5" 
            value={selectedQubit.position[0]} 
            onChange={(e) => handlePosChange(0, e.target.value)} 
            title="X Axis"
          />
          <input 
            type="number" step="0.5" 
            value={selectedQubit.position[1]} 
            onChange={(e) => handlePosChange(1, e.target.value)} 
            title="Y Axis"
          />
          <input 
            type="number" step="0.5" 
            value={selectedQubit.position[2]} 
            onChange={(e) => handlePosChange(2, e.target.value)} 
            title="Z Axis"
          />
        </div>
      </div>

      <hr className="divider" />

      {/* 2. ROTATION & GATES */}
      <Accordion 
        title="Euler Rotation" 
        isOpen={activeMenu === 'default'} 
        onToggle={() => toggleMenu('default')}
      >
        <DefaultRotation 
          key={selectedQubit.id + '-def'} 
          setRotation={(rot) => onUpdate(selectedQubit.id, { rotation: rot })} 
        />
      </Accordion>

      <Accordion 
        title="Custom Axis" 
        isOpen={activeMenu === 'custom'} 
        onToggle={() => toggleMenu('custom')}
      >
        <CustomRotation 
          key={selectedQubit.id + '-cust'}
          setRotation={(rot) => onUpdate(selectedQubit.id, { rotation: rot })} 
        />
      </Accordion>

      <Accordion 
        title="Quantum Gates" 
        isOpen={activeMenu === 'gates'} 
        onToggle={() => toggleMenu('gates')}
      >
        <QuantumGates 
          key={selectedQubit.id + '-gate'}
          rotation={selectedQubit.rotation} 
          setRotation={(rot) => onUpdate(selectedQubit.id, { rotation: rot })} 
        />
      </Accordion>
    </aside>
  );
}