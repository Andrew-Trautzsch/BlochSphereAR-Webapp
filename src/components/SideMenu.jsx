import React, { useState } from 'react';
import AccordionMenu from './AccordionMenu';
import DefaultRotationMenu from './DefaultRotationMenu';
import CustomRotationMenu from './CustomRotationMenu';

export default function SideMenu({ rotation, setRotation }) {
  // State to manage which menu is open. 'default', 'custom', 'gates', or null
  const [openMenu, setOpenMenu] = useState('default');

  return (
    <div className="side-menu">
      <AccordionMenu
        title="Default Rotation (Euler)"
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

      {/* Placeholder for your next menu */}
      {/*
      <AccordionMenu
        title="Quantum Gates"
        isOpen={openMenu === 'gates'}
        setIsOpen={() => setOpenMenu(openMenu === 'gates' ? null : 'gates')}
      >
        <p>Quantum Gate buttons will go here.</p>
      </AccordionMenu>
      */}
    </div>
  );
}