import { useState, useMemo, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import Sidebar from './components/Sidebar/Sidebar';
import BlochSphere from './components/BlochSphere/BlochSphere';
import CircuitGrid from './components/Circuit/CircuitGrid';
import {
  simulateAllQubits,
  createBellStateCircuit,
  createGHZCircuit,
  createTeleportationCircuit,
} from './utils/quantum';
import './App.css';

function App() {
  // --- LAYOUT STATE ---
  const [sidebarWidth, setSidebarWidth]     = useState(360);
  const [bottomHeight, setBottomHeight]     = useState(200);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingBottom,  setIsResizingBottom]  = useState(false);

  // --- APP STATE ---
  const [qubits, setQubits] = useState([
    { id: 1, name: 'Qubit 1', rotation: new THREE.Quaternion(), position: [0, 0, 0], groupId: null }
  ]);
  const [circuit,  setCircuit]  = useState({});
  const [groups,   setGroups]   = useState([]);
  const [selected, setSelected] = useState(null);

  // --- PLAYBACK STATE ---
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const MAX_STEPS = 20;

  // --- PLAYBACK ENGINE ---
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= MAX_STEPS) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handlePlayPause  = () => setIsPlaying(p => !p);
  const handleStop       = () => { setIsPlaying(false); setCurrentStep(0); };
  const handleStepChange = (e) => { setIsPlaying(false); setCurrentStep(Number(e.target.value)); };

  // --- RESIZING ---
  const startResizingSidebar = () => setIsResizingSidebar(true);
  const startResizingBottom  = () => setIsResizingBottom(true);

  const stopResizing = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingBottom(false);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isResizingSidebar) setSidebarWidth(Math.max(200, Math.min(e.clientX, 600)));
    if (isResizingBottom) {
      const newH = Math.max(100, Math.min(window.innerHeight - e.clientY, window.innerHeight * 0.6));
      setBottomHeight(newH);
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

  // --- QUBIT / GROUP LOGIC ---
  const getSubtreeGroupIds = useCallback((startId) => {
    const ids = new Set([startId]);
    let added = true;
    while (added) {
      added = false;
      for (const g of groups) {
        if (g.parentId !== null && ids.has(g.parentId) && !ids.has(g.id)) {
          ids.add(g.id); added = true;
        }
      }
    }
    return Array.from(ids);
  }, [groups]);

  const highlightedQubitIds = useMemo(() => {
    if (!selected) return new Set();
    if (selected.type === 'qubit') return new Set([selected.id]);
    if (selected.type === 'group') {
      const subtree = getSubtreeGroupIds(selected.id);
      return new Set(
        qubits.filter(q => q.groupId !== null && subtree.includes(q.groupId)).map(q => q.id)
      );
    }
    return new Set();
  }, [selected, qubits, getSubtreeGroupIds]);

  const createGroup = useCallback((parentId = null) => {
    const newId = Date.now();
    setGroups(prev => [...prev, { id: newId, name: `Group ${groups.length + 1}`, parentId }]);
    setSelected({ type: 'group', id: newId });
  }, [groups.length]);

  const moveGroup = useCallback((groupId, newParentId) => {
    if (newParentId !== null && getSubtreeGroupIds(groupId).includes(newParentId)) return;
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, parentId: newParentId } : g));
  }, [getSubtreeGroupIds]);

  const handleDeleteGroup = useCallback((groupId) => {
    const subtree = getSubtreeGroupIds(groupId);
    setQubits(prev => prev.map(q =>
      q.groupId !== null && subtree.includes(q.groupId) ? { ...q, groupId: null } : q
    ));
    setGroups(prev =>
      prev.filter(g => g.id !== groupId)
          .map(g => g.parentId === groupId ? { ...g, parentId: null } : g)
    );
    if (selected?.type === 'group' && selected.id === groupId) setSelected(null);
  }, [getSubtreeGroupIds, selected]);

  const handleGroupPositionChange = useCallback((groupId, axisIndex, newValue) => {
    const subtree       = getSubtreeGroupIds(groupId);
    const subtreeQubits = qubits.filter(q => q.groupId !== null && subtree.includes(q.groupId));
    if (subtreeQubits.length === 0) return;
    const oldAvg = subtreeQubits.reduce(
      (s, q) => { s[0] += q.position[0]||0; s[1] += q.position[1]||0; s[2] += q.position[2]||0; return s; },
      [0,0,0]
    ).map(v => v / subtreeQubits.length);
    const delta = (parseFloat(newValue) || 0) - oldAvg[axisIndex];
    setQubits(prev => prev.map(q => {
      if (q.groupId !== null && subtree.includes(q.groupId)) {
        const newPos = [...q.position]; newPos[axisIndex] += delta;
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

  // --- CIRCUIT PRESETS ──────────────────────────────────────────────────────
  // Ensures at least `count` qubits exist, adding them if needed.
  // Returns the (possibly extended) qubit array synchronously so the
  // circuit factory can use the correct IDs before the next render.
  const ensureQubits = (count) => {
    if (qubits.length >= count) return qubits;

    const extended = [...qubits];
    for (let i = qubits.length; i < count; i++) {
      const maxX = extended.length > 0
        ? Math.max(...extended.map(q => q.position[0]))
        : -2.5;
      extended.push({
        id:       Date.now() + i,
        name:     `Qubit ${extended.length + 1}`,
        rotation: new THREE.Quaternion(),
        position: [maxX + 2.5, 0, 0],
        groupId:  null,
      });
    }
    setQubits(extended);
    return extended;
  };

  const applyPreset = (factory, minQubits) => {
    const workQubits = ensureQubits(minQubits);
    const ids        = workQubits.slice(0, minQubits).map(q => q.id);
    setCircuit(factory(ids));
    setCurrentStep(0);
    setIsPlaying(false);
  };

  // --- STATE VECTOR SIMULATION ---
  const computedQubits = useMemo(() => {
    const blochResults = simulateAllQubits(qubits, circuit, currentStep);
    return qubits.map((q, i) => ({
      ...q,
      blochData: blochResults[i] ?? null,
    }));
  }, [qubits, circuit, currentStep]);

  // --- RENDER ---
  return (
    <div className="app-layout">

      {/* 1. Left Sidebar */}
      <div className="sidebar-container" style={{ width: sidebarWidth }}>
        <Sidebar
          qubits={computedQubits}
          groups={groups}
          selected={selected}
          onSelect={setSelected}
          onAddQubit={(targetGroupId = null) => {
            const newId = Date.now();
            const maxX  = qubits.length > 0 ? Math.max(...qubits.map(q => q.position[0])) : -2.5;
            setQubits(prev => [...prev, {
              id: newId,
              name: `Qubit ${qubits.length + 1}`,
              rotation: new THREE.Quaternion(),
              position: [maxX + 2.5, 0, 0],
              groupId: targetGroupId,
            }]);
            setSelected({ type: 'qubit', id: newId });
          }}
          onCreateGroup={createGroup}
          onUpdateQubit={(id, changes) =>
            setQubits(prev => prev.map(q => q.id === id ? { ...q, ...changes } : q))
          }
          onUpdateGroup={(id, changes) =>
            setGroups(prev => prev.map(g => g.id === id ? { ...g, ...changes } : g))
          }
          onMoveGroup={moveGroup}
          onGroupPositionChange={handleGroupPositionChange}
          onDeleteGroup={handleDeleteGroup}
        />
      </div>

      <div className="resizer-vertical" onMouseDown={startResizingSidebar} />

      {/* 2. Main Content */}
      <main className="main-content">

        {/* Bloch sphere view */}
        <div className="sphere-pane" style={{ height: `calc(100% - ${bottomHeight}px)` }}>
          <BlochSphere
            qubits={computedQubits}
            selected={selected}
            highlightedIds={highlightedQubitIds}
            onSelect={setSelected}
          />
        </div>

        <div className="resizer-horizontal" onMouseDown={startResizingBottom} />

        {/* Circuit pane */}
        <div className="circuit-pane" style={{ height: bottomHeight }}>
          <div className="circuit-controls">

            {/* Playback */}
            <button className="control-btn" onClick={handlePlayPause}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button className="control-btn" onClick={handleStop}>⏹ Stop</button>

            {/* Circuit presets */}
            <span className="preset-label">Presets:</span>
            <button
              className="control-btn preset-btn preset-bell"
              title="Φ+ Bell state — H on q0, CNOT(q0→q1). Creates maximally entangled pair."
              onClick={() => applyPreset(createBellStateCircuit, 2)}
            >
              Φ+ Bell
            </button>
            <button
              className="control-btn preset-btn preset-ghz"
              title="GHZ state — all qubits maximally entangled: (|00…0⟩+|11…1⟩)/√2"
              onClick={() => applyPreset(createGHZCircuit, Math.max(qubits.length, 3))}
            >
              GHZ
            </button>
            <button
              className="control-btn preset-btn preset-teleport"
              title="Quantum teleportation (unitary portion). q0=input, q1=Alice, q2=Bob."
              onClick={() => applyPreset(createTeleportationCircuit, 3)}
            >
              Teleport
            </button>

            {/* Step scrubber */}
            <div className="scrubber-container">
              <span className="step-label">Step: {currentStep} / {MAX_STEPS}</span>
              <input
                type="range" min="0" max={MAX_STEPS} value={currentStep}
                onChange={handleStepChange} className="scrubber-slider"
              />
            </div>
          </div>

          <div className="circuit-grid-wrapper">
            <CircuitGrid
              qubits={qubits}
              circuit={circuit}
              onGateChange={handleGateChange}
              currentStep={currentStep}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;