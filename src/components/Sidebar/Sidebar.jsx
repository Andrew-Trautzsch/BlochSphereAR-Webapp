import React, { useState } from 'react';
import Accordion from '../UI/Accordion';
import DefaultRotation from './menus/DefaultRotation';
import CustomRotation from './menus/CustomRotation';
import QuantumGates from './menus/QuantumGates';
import './Sidebar.css';

export default function Sidebar({ rotation, setRotation }) {
  const [activeMenu, setActiveMenu] = useState('default');

  const toggleMenu =ub => (menu) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  return (
    <aside className="side-menu">
      <h2>Qubit Controls</h2>

      <Accordion 
        title="Euler Rotation" 
        isOpen={activeMenu === 'default'} 
        onToggle={() => toggleMenu('default')}
      >
        <DefaultRotation setRotation={setRotation} />
      </Accordion>

      <Accordion 
        title="Custom Axis" 
        isOpen={activeMenu === 'custom'} 
        onToggle={() => toggleMenu('custom')}
      >
        <CustomRotation setRotation={setRotation} />
      </Accordion>

      <Accordion 
        title="Quantum Gates" 
        isOpen={activeMenu === 'gates'} 
        onToggle={() => toggleMenu('gates')}
      >
        <QuantumGates rotation={rotation} setRotation={setRotation} />
      </Accordion>
    </aside>
  );
}