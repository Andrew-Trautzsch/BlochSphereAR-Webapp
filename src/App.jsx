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
import {
  createSubroutine,
  stampSubroutine,
  makeInstanceId,
} from './utils/subroutines';
import './App.css';

const TOPO_TO_3D = 1 / 40;
const TOTAL_STEPS = 20;

function App() {
  // --- LAYOUT STATE ---
  const [sidebarWidth, setSidebarWidth]           = useState(360);
  const [bottomHeight, setBottomHeight]           = useState(200);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingBottom,  setIsResizingBottom]  = useState(false);

  // --- MODE ---
  const [mode, setMode] = useState('simulate');

  // --- SIMULATION STATE ---
  const [qubits,   setQubits]   = useState([
    { id: 1, name: 'Qubit 1', rotation: new THREE.Quaternion(), position: [0, 0, 0], groupId: null, topoPos: [120, 120] }
  ]);
  const [circuit,  setCircuit]  = useState({});
  const [groups,   setGroups]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [simEdges, setSimEdges] = useState([]);

  // --- MEASUREMENT STATE ---
  const [stochastic,        setStochastic]        = useState(false);
  const measurementCacheRef = useRef({});

  // --- TOPOLOGY CANVAS STATE ---
  const [topoQubits,  setTopoQubits]  = useState([]);
  const [topoEdges,   setTopoEdges]   = useState([]);
  const [savedShapes, setSavedShapes] = useState([]);

  // --- PLAYBACK ---
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);

  // ═══════════════════════════════════════════════════════
  // SUBROUTINE STATE
  // ═══════════════════════════════════════════════════════
  // Library of named subroutine definitions
  const [subroutines, setSubroutines] = useState([]);

  // Placed instances: { id, subroutine, qubitIds, stepStart }
  const [subroutineInstances, setSubroutineInstances] = useState([]);

  // Which subroutine id is currently being stamped (null = none)
  const [stampingId, setStampingId] = useState(null);

  /**
   * Called from CircuitGrid when the user finishes a rectangular
   * selection and types a name in the editor modal.
   */
  const handleSaveSubroutine = useCallback((name, selectedQubits, stepStart, stepEnd) => {
    const sr = createSubroutine(name, selectedQubits, circuit, stepStart, stepEnd);
    setSubroutines(prev => [...prev, sr]);
  }, [circuit]);

  /** Enter stamp mode for a given subroutine id */
  const handleStartStamp = useCallback((srId) => {
    setStampingId(srId);
  }, []);

  const handleCancelStamp = useCallback(() => {
    setStampingId(null);
  }, []);

  /**
   * Called when the user clicks a cell in stamp mode.
   * rowIdx = qubit row index, colIdx = step column index.
   */
  const handleStampAt = useCallback((rowIdx, colIdx) => {
    const sr = subroutines.find(s => s.id === stampingId);
    if (!sr) return;

    // Target qubits starting at rowIdx
    const targetQubits = qubits.slice(rowIdx, rowIdx + sr.qubitCount);
    if (targetQubits.length < sr.qubitCount) {
      // Not enough qubits below — stamp as many as we can
      // (user can add more qubits first)
      alert(`Need ${sr.qubitCount} qubits starting from row ${rowIdx + 1}, but only ${targetQubits.length} available.`);
      return;
    }

    // Write gates into circuit
    const newCircuit = stampSubroutine(circuit, sr, targetQubits, colIdx, TOTAL_STEPS);
    measurementCacheRef.current = {};
    setCircuit(newCircuit);

    // Record the instance so we can draw the overlay
    const instance = {
      id:         makeInstanceId(),
      subroutine: sr,
      qubitIds:   targetQubits.map(q => q.id),
      stepStart:  colIdx,
    };
    setSubroutineInstances(prev => [...prev, instance]);
    setStampingId(null);
  }, [subroutines, stampingId, qubits, circuit]);

  /** Remove a subroutine definition from the library */
  const handleDeleteSubroutine = useCallback((srId) => {
    setSubroutines(prev => prev.filter(s => s.id !== srId));
    // Remove instances of that subroutine
    setSubroutineInstances(prev => prev.filter(inst => inst.subroutine.id !== srId));
    if (stampingId === srId) setStampingId(null);
  }, [stampingId]);

  /** Remove a placed instance overlay (does NOT erase the gates) */
  const handleRemoveInstance = useCallback((instanceId) => {
    setSubroutineInstances(prev => prev.filter(inst => inst.id !== instanceId));
  }, []);

  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= TOTAL_STEPS) { setIsPlaying(false); return prev; }
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
    measurementCacheRef.current = {};
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
    measurementCacheRef.current = {};
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
    measurementCacheRef.current = {};
  };

  // --- TOPOLOGY CANVAS HANDLERS ---
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

  const handleSaveShape = useCallback((name) => {
    setSavedShapes(prev => [...prev, {
      name,
      qubits: topoQubits.map(q => ({ id: q.id, name: q.name, topoPos: [...q.topoPos] })),
      edges:  topoEdges.map(e => [...e]),
    }]);
  }, [topoQubits, topoEdges]);

  const handleLoadShape = useCallback((shape) => {
    setTopoQubits(shape.qubits.map(q => ({ ...q, topoPos: [...q.topoPos] })));
    setTopoEdges(shape.edges.map(e => [...e]));
  }, []);

  const handleStampShape = useCallback((shape) => {
    const groupId = Date.now();
    const base    = groupId + 1;
    const existingMaxX = qubits.length > 0
      ? Math.max(...qubits.map(q => q.position[0]))
      : -2.5;
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
        id: newId, name: `${shape.name} ${sq.name}`,
        rotation: new THREE.Quaternion(),
        position: [existingMaxX + 2.5 + relX, 0, relZ],
        groupId: groupId, topoPos: [...sq.topoPos],
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
    setSimEdges(prev => {
      const exists = prev.some(([a, b]) => (a === aId && b === bId) || (a === bId && b === aId));
      return exists ? prev : [...prev, [aId, bId]];
    });
  }, []);
  const handleRemoveSimEdge = useCallback((aId, bId) => {
    setSimEdges(prev =>
      prev.filter(([a, b]) => !((a === aId && b === bId) || (a === bId && b === aId)))
    );
  }, []);

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

  const measuredQubits = useMemo(() => {
    const map = {};
    computedQubits.forEach(q => {
      if (q.blochData?.measured) {
        const row  = circuit[q.id] || [];
        const step = row.findIndex(g => g === 'M');
        if (step !== -1) map[q.id] = { outcome: q.blochData.measurementOutcome, step };
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
                  onClick={() => { measurementCacheRef.current = {}; setStochastic(s => !s); }}
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
                  <span className="step-label">Step: {currentStep} / {TOTAL_STEPS}</span>
                  <input type="range" min="0" max={TOTAL_STEPS} value={currentStep}
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
                  subroutines={subroutines}
                  subroutineInstances={subroutineInstances}
                  stampingId={stampingId}
                  onSaveSubroutine={handleSaveSubroutine}
                  onStartStamp={handleStartStamp}
                  onCancelStamp={handleCancelStamp}
                  onStampAt={handleStampAt}
                  onDeleteSubroutine={handleDeleteSubroutine}
                  onRemoveInstance={handleRemoveInstance}
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