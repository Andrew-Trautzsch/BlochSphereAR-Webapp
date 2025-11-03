import React, { useState } from 'react';
import AccordionMenu from './AccordionMenu';
import DefaultRotationMenu from './DefaultRotationMenu';
import CustomRotationMenu from './CustomRotationMenu';
import QuantumGatesMenu from './QuantumGatesMenu';

// Receive new props
export default function SideMenu({ 
  rotation, setRotation, showTrail, setShowTrail 
}) {
  const [openMenu, setOpenMenu] = useState('default');

  return (
    <div className="side-menu">
      <AccordionMenu
        title="Default Rotation"
        isOpen={openMenu === 'default'}
        setIsOpen={() => setOpenMenu(openMenu === 'default' ? null : 'default')}
      >
        <DefaultRotationMenu rotation={rotation} setRotation={setRotation} />
      </AccordionMenu>

      <AccordionMenu
        title="Custom Axis Rotation"
        isOpen={openMenu === 'custom'}
        setIsOpen={() => setOpenMenu(openMenu === 'custom' ? null : 'custom')}
      >
        <CustomRotationMenu rotation={rotation} setRotation={setRotation} />
      </AccordionMenu>

      <AccordionMenu
        title="Quantum Gates"
        isOpen={openMenu === 'gates'}
        setIsOpen={() => setOpenMenu(openMenu === 'gates' ? null : 'gates')}
      >
        <QuantumGatesMenu rotation={rotation} setRotation={setRotation} />
      </AccordionMenu>

      {/* --- ADD NEW VISUALIZERS MENU --- */}
      <AccordionMenu
        title="Visualizers"
        isOpen={openMenu === 'visuals'}
        setIsOpen={() => setOpenMenu(openMenu === 'visuals' ? null : 'visuals')}
      >
        <div className="visualizer-toggle">
          <label htmlFor="trail-toggle">Show Vector Trail</label>
          <input
            id="trail-toggle"
            type="checkbox"
            checked={showTrail}
            onChange={(e) => setShowTrail(e.target.checked)}
          />
        </div>
      </AccordionMenu>
      {/* --- END NEW MENU --- */}
    </div>
  );
}