import { useState, useMemo, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import Sidebar from './components/Sidebar/Sidebar';
import BlochSphere from './components/BlochSphere/BlochSphere';
import CircuitGrid from './components/Circuit/CircuitGrid';
import { simulateCircuit } from './utils/quantum';
import './App.css';

function App() {
  // --- LAYOUT STATE ---
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [bottomHeight, setBottomHeight] = useState(200); // Default height for circuit
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  // --- APP STATE ---
  const [qubits, setQubits] = useState([
    { id: 1, name: 'Qubit 1', rotation: new THREE.Quaternion(), position: [0, 0, 0], groupId: null }
  ]);
  const [circuit, setCircuit] = useState({}); // Stores gates: { qubitId: ["H", null, "X"] }
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);

  // --- RESIZING LOGIC ---
  const startResizingSidebar = () => setIsResizingSidebar(true);
  const startResizingBottom = () => setIsResizingBottom(true);

  const stopResizing = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingBottom(false);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isResizingSidebar) {
      // Clamp width between 200px and 600px
      const newWidth = Math.max(200, Math.min(e.clientX, 600));
      setSidebarWidth(newWidth);
    }
    if (isResizingBottom) {
      // Clamp height between 100px and 50% of screen height
      const totalHeight = window.innerHeight;
      const newHeight = Math.max(100, Math.min(totalHeight - e.clientY, totalHeight * 0.6));
      setBottomHeight(newHeight);
    }
  }, [isResizingSidebar, isResizingBottom]);

  useEffect(() => {
    if (isResizingSidebar || isResizingBottom) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingSidebar, isResizingBottom, handleMouseMove, stopResizing]);

  // --- QUBIT & GROUP LOGIC ---
  
  // Helper: Get all group IDs in a subtree
  const getSubtreeGroupIds = useCallback((startId) => {
    const ids = new Set([startId]);
    let added = true;
    while (added) {
      added = false;
      for (const g of groups) {
        if (g.parentId !== null && ids.has(g.parentId) && !ids.has(g.id)) {
          ids.add(g.id);
          added = true;
        }
      }
    }
    return Array.from(ids);
  }, [groups]);

  // Highlight logic based on selection
  const highlightedQubitIds = useMemo(() => {
    if (!selected) return new Set();
    if (selected.type === 'qubit') return new Set([selected.id]);

    if (selected.type === 'group') {
      const subtree = getSubtreeGroupIds(selected.id);
      return new Set(
        qubits
          .filter(q => q.groupId !== null && subtree.includes(q.groupId))
          .map(q => q.id)
      );
    }
    return new Set();
  }, [selected, qubits, getSubtreeGroupIds]);

  // Group Management
  const createGroup = useCallback((parentId = null) => {
    const newId = Date.now();
    const newGroup = { id: newId, name: `Group ${groups.length + 1}`, parentId };
    setGroups(prev => [...prev, newGroup]);
    setSelected({ type: 'group', id: newId });
  }, [groups.length]);

  const moveGroup = useCallback((groupId, newParentId) => {
    if (newParentId !== null) {
      const subtree = getSubtreeGroupIds(groupId);
      if (subtree.includes(newParentId)) return; // prevent cycles
    }
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, parentId: newParentId } : g));
  }, [getSubtreeGroupIds]);

  const handleDeleteGroup = useCallback((groupId) => {
    const subtree = getSubtreeGroupIds(groupId);
    setQubits(prev => prev.map(q =>
      q.groupId !== null && subtree.includes(q.groupId) ? { ...q, groupId: null } : q
    ));
    setGroups(prev =>
      prev
        .filter(g => g.id !== groupId)
        .map(g => g.parentId === groupId ? { ...g, parentId: null } : g)
    );
    if (selected?.type === 'group' && selected.id === groupId) setSelected(null);
  }, [getSubtreeGroupIds, selected]);

  const handleGroupPositionChange = useCallback((groupId, axisIndex, newValue) => {
    const subtree = getSubtreeGroupIds(groupId);
    const subtreeQubits = qubits.filter(q => q.groupId !== null && subtree.includes(q.groupId));
    if (subtreeQubits.length === 0) return;

    const oldAvg = subtreeQubits.reduce((sum, q) => {
      sum[0] += q.position[0] || 0;
      sum[1] += q.position[1] || 0;
      sum[2] += q.position[2] || 0;
      return sum;
    }, [0, 0, 0]).map(v => v / subtreeQubits.length);

    const delta = (parseFloat(newValue) || 0) - oldAvg[axisIndex];

    setQubits(prev => prev.map(q => {
      if (q.groupId !== null && subtree.includes(q.groupId)) {
        const newPos = [...q.position];
        newPos[axisIndex] += delta;
        return { ...q, position: newPos };
      }
      return q;
    }));
  }, [qubits, getSubtreeGroupIds]);

  // --- CIRCUIT LOGIC ---

  const handleGateChange = (qubitId, stepIndex, gateName) => {
    setCircuit(prev => {
      const row = prev[qubitId] ? [...prev[qubitId]] : [];
      row[stepIndex] = gateName;
      return { ...prev, [qubitId]: row };
    });
  };

  // Compute final rotations based on circuit
  const computedQubits = useMemo(() => {
    return qubits.map(q => {
      const row = circuit[q.id] || [];
      const finalRot = simulateCircuit(q.rotation, row);
      return { ...q, rotation: finalRot };
    });
  }, [qubits, circuit]);

  // --- RENDER ---
  return (
    <div className="app-layout">
      {/* 1. Left Sidebar */}
      <div className="sidebar-container" style={{ width: sidebarWidth }}>
        <Sidebar
          qubits={computedQubits} // Show computed state in sidebar
          groups={groups}
          selected={selected}
          onSelect={setSelected}
          onAddQubit={(targetGroupId = null) => {
            const newId = Date.now();
            
            // Auto-offset logic:
            // Find the qubit with the largest X position to append to the right
            let maxX = -2.5;
            if (qubits.length > 0) {
               maxX = Math.max(...qubits.map(q => q.position[0]));
            }
            const startX = maxX + 2.5;

            const newQubit = {
              id: newId,
              name: `Qubit ${qubits.length + 1}`,
              rotation: new THREE.Quaternion(),
              position: [startX, 0, 0], // Spawn at offset
              groupId: targetGroupId
            };
            setQubits(prev => [...prev, newQubit]);
            setSelected({ type: 'qubit', id: newId });
          }}
          onCreateGroup={createGroup}
          onUpdateQubit={(id, changes) => setQubits(prev => prev.map(q => q.id === id ? { ...q, ...changes } : q))}
          onUpdateGroup={(id, changes) => setGroups(prev => prev.map(g => g.id === id ? { ...g, ...changes } : g))}
          onMoveGroup={moveGroup}
          onGroupPositionChange={handleGroupPositionChange}
          onDeleteGroup={handleDeleteGroup}
        />
      </div>

      {/* 2. Vertical Resizer (Sidebar Handle) */}
      <div className="resizer-vertical" onMouseDown={startResizingSidebar} />

      {/* 3. Right Content Area (Sphere + Circuit) */}
      <main className="main-content">
        
        {/* Top: 3D Scene */}
        <div className="sphere-pane" style={{ height: `calc(100% - ${bottomHeight}px)` }}>
          <BlochSphere
            qubits={computedQubits}
            selected={selected}
            highlightedIds={highlightedQubitIds}
            onSelect={setSelected}
          />
        </div>

        {/* Middle: Horizontal Resizer (Circuit Handle) */}
        <div className="resizer-horizontal" onMouseDown={startResizingBottom} />

        {/* Bottom: Circuit Grid */}
        <div className="circuit-pane" style={{ height: bottomHeight }}>
          <CircuitGrid 
            qubits={qubits} 
            circuit={circuit} 
            onGateChange={handleGateChange} 
          />
        </div>
      </main>
    </div>
  );
}

export default App;