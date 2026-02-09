import { useState } from 'react';
import * as THREE from 'three';
import Sidebar from './components/Sidebar/Sidebar';
import BlochSphere from './components/BlochSphere/BlochSphere';
import './App.css';

function App() {
  // 1. Qubit State now includes 'position' [x, y, z]
  const [qubits, setQubits] = useState([
    { 
      id: 1, 
      name: 'Qubit 1', 
      rotation: new THREE.Quaternion(), 
      position: [0, 0, 0] 
    }
  ]);
  
  // 2. Selected ID defaults to NULL (so we see the list first)
  const [selectedId, setSelectedId] = useState(null);

  const selectedQubit = qubits.find(q => q.id === selectedId);

  // Action: Add Qubit (Auto-offset position so they don't spawn inside each other)
  const addQubit = () => {
    const newId = Date.now();
    const offset = qubits.length * 2.5; // 2.5 units apart
    const newQubit = { 
      id: newId, 
      name: `Qubit ${qubits.length + 1}`, 
      rotation: new THREE.Quaternion(),
      position: [offset, 0, 0] 
    };
    setQubits([...qubits, newQubit]);
    setSelectedId(newId); // Auto-open the new qubit
  };

  // Action: Generic update for Position OR Rotation
  const updateQubit = (id, changes) => {
    setQubits(qubits.map(q => 
      q.id === id ? { ...q, ...changes } : q
    ));
  };

  return (
    <div className="app-layout">
      <Sidebar 
        qubits={qubits}
        selectedQubit={selectedQubit}
        onSelect={setSelectedId}
        onAdd={addQubit}
        onUpdate={updateQubit} 
      />
      
      <main className="main-content">
        <BlochSphere 
          qubits={qubits} 
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>
    </div>
  );
}

export default App;