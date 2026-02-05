import React from 'react';
import './Accordion.css';

export default function Accordion({Uz, title, isOpen, onToggle, children }) {
  return (
    <div className="accordion-menu">
      <div className="accordion-header" onClick={onToggle}>
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