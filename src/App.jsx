import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import Sidebar from './components/Sidebar/Sidebar';
import BlochSphere from './components/BlochSphere/BlochSphere';
import CircuitGrid from './components/Circuit/CircuitGrid';
import TopologyCanvas from './components/Topology/TopologyCanvas';
import {
  simulateAllQubits,
  createBellStateCircuit,
  createGHZCircuit,
  createTeleportationCircuit,
} from './utils/quantum';
import './App.css';

// Scale factor: topology canvas pixels → 3D world units
// Grid size is 40px; dividing by 40 maps one grid cell to 1 world unit.
const TOPO_TO_3D = 1 / 40;

function App() {
  // --- LAYOUT STATE ---
  const [sidebarWidth, setSidebarWidth]           = useState(360);
  const [bottomHeight, setBottomHeight]           = useState(200);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingBottom,  setIsResizingBottom]  = useState(false);

  // --- MODE ---
  const [mode, setMode] = useState('simulate'); // 'simulate' | 'topology'

  // --- SIMULATION STATE ---
  const [qubits,   setQubits]   = useState([
    { id: 1, name: 'Qubit 1', rotation: new THREE.Quaternion(), position: [0, 0, 0], groupId: null, topoPos: [120, 120] }
  ]);
  const [circuit,  setCircuit]  = useState({});
  const [groups,   setGroups]   = useState([]);
  const [selected, setSelected] = useState(null);

  // Simulation-side topology edges (populated when shapes are stamped)
  const [simEdges, setSimEdges] = useState([]);

  // --- MEASUREMENT STATE ---
  const [stochastic,        setStochastic]        = useState(false);
  // Cache stores { [qubitIdx_step]: 0|1 } — stable across re-renders in stochastic mode
  // Cleared when circuit changes or simulation resets
  const measurementCacheRef = useRef({});

  // --- TOPOLOGY CANVAS STATE (design tool, completely independent) ---
  const [topoQubits,  setTopoQubits]  = useState([]);
  const [topoEdges,   setTopoEdges]   = useState([]);
  const [savedShapes, setSavedShapes] = useState([]);

  // --- PLAYBACK ---
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const MAX_STEPS = 20;

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
  const handleStop       = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    measurementCacheRef.current = {}; // clear cached outcomes on reset
  };
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

  // --- GROUP UTILITIES ---
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

  // --- CIRCUIT ---
  const handleGateChange = (qubitId, stepIndex, gateName) => {
    measurementCacheRef.current = {}; // invalidate cached outcomes when circuit changes
    setCircuit(prev => {
      const row = prev[qubitId] ? [...prev[qubitId]] : [];
      row[stepIndex] = gateName;
      return { ...prev, [qubitId]: row };
    });
  };

  const ensureQubits = (count) => {
    if (qubits.length >= count) return qubits;
    const extended = [...qubits];
    for (let i = qubits.length; i < count; i++) {
      const maxX = extended.length > 0 ? Math.max(...extended.map(q => q.position[0])) : -2.5;
      extended.push({
        id: Date.now() + i, name: `Qubit ${extended.length + 1}`,
        rotation: new THREE.Quaternion(), position: [maxX + 2.5, 0, 0],
        groupId: null, topoPos: [120 + i * 80, 120],
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

  // --- TOPOLOGY CANVAS HANDLERS (design canvas only) ---
  const handleTopoUpdatePos    = useCallback((id, [x, y]) =>
    setTopoQubits(prev => prev.map(q => q.id === id ? { ...q, topoPos: [x, y] } : q)), []);

  const handleTopoAddQubit     = useCallback((x, y) => {
    const newId = Date.now();
    setTopoQubits(prev => [...prev, { id: newId, name: `q${prev.length}`, topoPos: [x, y] }]);
  }, []);

  const handleTopoDeleteQubit  = useCallback((id) => {
    setTopoQubits(prev => prev.filter(q => q.id !== id));
    setTopoEdges(prev => prev.filter(e => e[0] !== id && e[1] !== id));
  }, []);

  const handleTopoAddEdge      = useCallback((a, b) => setTopoEdges(prev => [...prev, [a, b]]), []);
  const handleTopoDeleteEdge   = useCallback((i)     => setTopoEdges(prev => prev.filter((_, idx) => idx !== i)), []);

  // Save: snapshot current canvas as a named template. No simulation changes.
  const handleSaveShape = useCallback((name) => {
    setSavedShapes(prev => [...prev, {
      name,
      qubits: topoQubits.map(q => ({ id: q.id, name: q.name, topoPos: [...q.topoPos] })),
      edges:  topoEdges.map(e => [...e]),
    }]);
  }, [topoQubits, topoEdges]);

  // Load into topology canvas for editing (still no simulation changes).
  const handleLoadShape = useCallback((shape) => {
    setTopoQubits(shape.qubits.map(q => ({ ...q, topoPos: [...q.topoPos] })));
    setTopoEdges(shape.edges.map(e => [...e]));
  }, []);

  // --- STAMP SHAPE INTO SIMULATION ---
  // Fresh IDs, new group, 2D topoPos → 3D position, remapped edges.
  const handleStampShape = useCallback((shape) => {
    const groupId = Date.now();
    const base    = groupId + 1;

    const existingMaxX = qubits.length > 0
      ? Math.max(...qubits.map(q => q.position[0]))
      : -2.5;

    // Normalise relative to shape's own bounding box
    const xs   = shape.qubits.map(q => q.topoPos[0]);
    const ys   = shape.qubits.map(q => q.topoPos[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    const idRemap  = {};
    const newQubits = shape.qubits.map((sq, i) => {
      const newId    = base + i;
      idRemap[sq.id] = newId;
      const relX     = (sq.topoPos[0] - minX) * TOPO_TO_3D;
      const relZ     = (sq.topoPos[1] - minY) * TOPO_TO_3D;
      return {
        id:       newId,
        name:     `${shape.name} ${sq.name}`,
        rotation: new THREE.Quaternion(),
        position: [existingMaxX + 2.5 + relX, 0, relZ],
        groupId:  groupId,
        topoPos:  [...sq.topoPos],
      };
    });

    const newEdges = shape.edges
      .map(([a, b]) => [idRemap[a], idRemap[b]])
      .filter(([a, b]) => a !== undefined && b !== undefined);

    setGroups(prev   => [...prev, { id: groupId, name: shape.name, parentId: null }]);
    setQubits(prev   => [...prev, ...newQubits]);
    setSimEdges(prev => [...prev, ...newEdges]);
    setSelected({ type: 'group', id: groupId });
  }, [qubits]);

  // --- SIM EDGE MANAGEMENT ---
  const handleAddSimEdge = useCallback((aId, bId) => {
    // Prevent duplicates in both directions
    setSimEdges(prev => {
      const exists = prev.some(
        ([a, b]) => (a === aId && b === bId) || (a === bId && b === aId)
      );
      return exists ? prev : [...prev, [aId, bId]];
    });
  }, []);

  const handleRemoveSimEdge = useCallback((aId, bId) => {
    setSimEdges(prev =>
      prev.filter(([a, b]) => !((a === aId && b === bId) || (a === bId && b === aId)))
    );
  }, []);

  // --- CIRCUIT GRID EDGE SET ---
  const simEdgeSet = useMemo(() => {
    const s = new Set();
    simEdges.forEach(([a, b]) => { s.add(`${a}-${b}`); s.add(`${b}-${a}`); });
    return s;
  }, [simEdges]);

  // --- STATE VECTOR SIMULATION ---
  const computedQubits = useMemo(() => {
    const blochResults = simulateAllQubits(
      qubits, circuit, currentStep,
      stochastic, measurementCacheRef.current
    );
    return qubits.map((q, i) => ({ ...q, blochData: blochResults[i] ?? null }));
  }, [qubits, circuit, currentStep, stochastic]);

  // Build measuredQubits map for CircuitGrid: { [qubitId]: { outcome, step } }
  const measuredQubits = useMemo(() => {
    const map = {};
    computedQubits.forEach(q => {
      if (q.blochData?.measured) {
        // Find which step the M gate is on for this qubit
        const row = circuit[q.id] || [];
        const step = row.findIndex(g => g === 'M');
        if (step !== -1) {
          map[q.id] = { outcome: q.blochData.measurementOutcome, step };
        }
      }
    });
    return map;
  }, [computedQubits, circuit]);

  return (
    <div className="app-layout">

      <div className="sidebar-container" style={{ width: sidebarWidth }}>
        <Sidebar
          qubits={computedQubits}
          groups={groups}
          selected={selected}
          onSelect={setSelected}
          onAddQubit={(targetGroupId = null) => {
            const newId = Date.now();
            const maxX  = qubits.length > 0 ? Math.max(...qubits.map(q => q.position[0])) : -2.5;
            const count = qubits.length;
            setQubits(prev => [...prev, {
              id: newId, name: `Qubit ${count + 1}`,
              rotation: new THREE.Quaternion(), position: [maxX + 2.5, 0, 0],
              groupId: targetGroupId, topoPos: [120 + count * 80, 120],
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
          savedShapes={savedShapes}
          onStampShape={handleStampShape}
          simEdges={simEdges}
          onAddSimEdge={handleAddSimEdge}
          onRemoveSimEdge={handleRemoveSimEdge}
        />
      </div>

      <div className="resizer-vertical" onMouseDown={startResizingSidebar} />

      <main className="main-content">
        <div className="mode-toggle-bar">
          <button className={`mode-btn ${mode === 'simulate' ? 'active' : ''}`}
            onClick={() => setMode('simulate')}>
            <span className="mode-btn-icon">◈</span> Simulate
          </button>
          <button className={`mode-btn ${mode === 'topology' ? 'active' : ''}`}
            onClick={() => setMode('topology')}>
            <span className="mode-btn-icon">⬡</span> Topology
          </button>
          {mode === 'simulate' && simEdges.length > 0 && (
            <span className="mode-topo-info">
              {simEdges.length} connection{simEdges.length !== 1 ? 's' : ''} active
            </span>
          )}
        </div>

        {mode === 'simulate' ? (
          <>
            <div className="sphere-pane" style={{ height: `calc(100% - ${bottomHeight}px - 40px)` }}>
              <BlochSphere
                qubits={computedQubits}
                selected={selected}
                highlightedIds={highlightedQubitIds}
                onSelect={setSelected}
                circuit={circuit}
                currentStep={currentStep}
                edges={simEdges}
                onAddSimEdge={handleAddSimEdge}
              />
            </div>

            <div className="resizer-horizontal" onMouseDown={startResizingBottom} />

            <div className="circuit-pane" style={{ height: bottomHeight }}>
              <div className="circuit-controls">
                <button className="control-btn" onClick={handlePlayPause}>
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button className="control-btn" onClick={handleStop}>⏹ Stop</button>

                <button
                  className={`control-btn measure-mode-btn ${stochastic ? 'stochastic' : 'deterministic'}`}
                  onClick={() => {
                    measurementCacheRef.current = {};
                    setStochastic(s => !s);
                  }}
                  title={stochastic
                    ? 'Stochastic: measurement outcomes are random. Click to switch to deterministic.'
                    : 'Deterministic: always collapses to higher-probability outcome. Click to switch to stochastic.'}
                >
                  {stochastic ? '⚄ Stochastic' : '⊟ Deterministic'}
                </button>
                <span className="preset-label">Presets:</span>
                <button className="control-btn preset-btn preset-bell"
                  onClick={() => applyPreset(createBellStateCircuit, 2)}>Φ+ Bell</button>
                <button className="control-btn preset-btn preset-ghz"
                  onClick={() => applyPreset(createGHZCircuit, Math.max(qubits.length, 3))}>GHZ</button>
                <button className="control-btn preset-btn preset-teleport"
                  onClick={() => applyPreset(createTeleportationCircuit, 3)}>Teleport</button>
                <div className="scrubber-container">
                  <span className="step-label">Step: {currentStep} / {MAX_STEPS}</span>
                  <input type="range" min="0" max={MAX_STEPS} value={currentStep}
                    onChange={handleStepChange} className="scrubber-slider" />
                </div>
              </div>
              <div className="circuit-grid-wrapper">
                <CircuitGrid
                  qubits={qubits}
                  circuit={circuit}
                  onGateChange={handleGateChange}
                  currentStep={currentStep}
                  edgeSet={simEdges.length > 0 ? simEdgeSet : null}
                  measuredQubits={measuredQubits}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="topology-pane">
            <TopologyCanvas
              qubits={topoQubits}
              edges={topoEdges}
              onUpdateQubitPosition={handleTopoUpdatePos}
              onAddQubit={handleTopoAddQubit}
              onDeleteQubit={handleTopoDeleteQubit}
              onAddEdge={handleTopoAddEdge}
              onDeleteEdge={handleTopoDeleteEdge}
              onSaveShape={handleSaveShape}
              savedShapes={savedShapes}
              onLoadShape={handleLoadShape}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;