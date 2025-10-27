import React from 'react';

export default function AccordionMenu({ title, children, isOpen, setIsOpen }) {
  return (
    <div className="accordion-menu">
      <div className="accordion-header" onClick={setIsOpen}>
        <h3>{title}</h3>
        <span>{isOpen ? '−' : '+'}</span>
      </div>
      {isOpen && (
        <div className="accordion-content">
          {children}
        </div>
      )}
    </div>
  );
}