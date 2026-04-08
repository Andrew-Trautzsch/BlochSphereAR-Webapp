import React, { useState, useRef, useCallback, useEffect } from 'react';
import './TopologyCanvas.css';

const GRID_SIZE = 40;
const NODE_RADIUS = 22;

function snapToGrid(val) {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

export default function TopologyCanvas({
  qubits,
  edges,
  onUpdateQubitPosition,
  onAddQubit,
  onDeleteQubit,
  onAddEdge,
  onDeleteEdge,
  onSaveShape,
  savedShapes,
  onLoadShape,
}) {
  const svgRef = useRef(null);
  const [tool, setTool] = useState('select'); // 'select' | 'addNode' | 'addEdge' | 'delete'
  const [dragging, setDragging] = useState(null); // { qubitId, offsetX, offsetY }
  const [edgeStart, setEdgeStart] = useState(null); // qubitId
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredQubit, setHoveredQubit] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [shapeName, setShapeName] = useState('');

  const getSVGPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleSVGMouseMove = useCallback((e) => {
    const pt = getSVGPoint(e);
    setMousePos(pt);

    if (dragging) {
      const newX = snapToGrid(pt.x - dragging.offsetX);
      const newY = snapToGrid(pt.y - dragging.offsetY);
      onUpdateQubitPosition(dragging.qubitId, [newX, newY]);
    }
  }, [dragging, getSVGPoint, onUpdateQubitPosition]);

  const handleSVGMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleSVGClick = useCallback((e) => {
    if (tool !== 'addNode') return;
    const pt = getSVGPoint(e);
    const x = snapToGrid(pt.x);
    const y = snapToGrid(pt.y);
    // Don't place on top of existing qubit
    const tooClose = qubits.some(q => {
      const [qx, qy] = q.topoPos || [0, 0];
      return Math.hypot(qx - x, qy - y) < NODE_RADIUS * 2;
    });
    if (!tooClose) onAddQubit(x, y);
  }, [tool, getSVGPoint, qubits, onAddQubit]);

  const handleNodeMouseDown = useCallback((e, qubitId) => {
    e.stopPropagation();
    if (tool === 'delete') {
      onDeleteQubit(qubitId);
      return;
    }
    if (tool === 'addEdge') {
      if (!edgeStart) {
        setEdgeStart(qubitId);
      } else if (edgeStart !== qubitId) {
        // Check edge doesn't already exist
        const exists = edges.some(
          ed => (ed[0] === edgeStart && ed[1] === qubitId) ||
                (ed[1] === edgeStart && ed[0] === qubitId)
        );
        if (!exists) onAddEdge(edgeStart, qubitId);
        setEdgeStart(null);
      } else {
        setEdgeStart(null);
      }
      return;
    }
    if (tool === 'select') {
      const pt = getSVGPoint(e);
      const [qx, qy] = qubits.find(q => q.id === qubitId)?.topoPos || [0, 0];
      setDragging({ qubitId, offsetX: pt.x - qx, offsetY: pt.y - qy });
    }
  }, [tool, edgeStart, edges, qubits, getSVGPoint, onAddEdge, onDeleteQubit]);

  const handleEdgeClick = useCallback((e, edgeIndex) => {
    e.stopPropagation();
    if (tool === 'delete') onDeleteEdge(edgeIndex);
  }, [tool, onDeleteEdge]);

  const handleSave = () => {
    if (!shapeName.trim()) return;
    onSaveShape(shapeName.trim());
    setShapeName('');
    setSaveModalOpen(false);
  };

  // Cancel edge drawing on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setEdgeStart(null); setTool('select'); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const getQubitPos = (id) => {
    const q = qubits.find(q => q.id === id);
    return q?.topoPos || [0, 0];
  };

  // Ghost edge while drawing
  const ghostEdge = edgeStart ? (() => {
    const [x1, y1] = getQubitPos(edgeStart);
    return { x1, y1, x2: mousePos.x, y2: mousePos.y };
  })() : null;

  const tools = [
    { key: 'select', icon: '↖', label: 'Select / drag' },
    { key: 'addNode', icon: '⊕', label: 'Add qubit' },
    { key: 'addEdge', icon: '—', label: 'Draw edge' },
    { key: 'delete', icon: '✕', label: 'Delete' },
  ];

  return (
    <div className="topo-canvas-root">
      {/* Toolbar */}
      <div className="topo-toolbar">
        <div className="topo-tools">
          {tools.map(t => (
            <button
              key={t.key}
              className={`topo-tool-btn ${tool === t.key ? 'active' : ''}`}
              onClick={() => { setTool(t.key); setEdgeStart(null); }}
              title={t.label}
            >
              <span className="topo-tool-icon">{t.icon}</span>
              <span className="topo-tool-label">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="topo-toolbar-right">
          <span className="topo-status">
            {tool === 'addEdge' && edgeStart
              ? `Click target qubit to complete edge`
              : tool === 'addNode'
              ? 'Click canvas to place qubit'
              : `${qubits.length} qubits · ${edges.length} edges`}
          </span>
          <button className="topo-save-btn" onClick={() => setSaveModalOpen(true)}>
            Save shape
          </button>
        </div>
      </div>

      <div className="topo-workspace">
        {/* Saved shapes sidebar */}
        <div className="topo-library">
          <div className="topo-library-header">Saved shapes</div>
          {savedShapes.length === 0 && (
            <div className="topo-library-empty">No saved shapes yet</div>
          )}
          {savedShapes.map((shape, i) => (
            <button
              key={i}
              className="topo-library-item"
              onClick={() => onLoadShape(shape)}
            >
              <span className="topo-library-name">{shape.name}</span>
              <span className="topo-library-meta">{shape.qubits.length}q · {shape.edges.length}e</span>
            </button>
          ))}
        </div>

        {/* Main SVG canvas */}
        <svg
          ref={svgRef}
          className={`topo-svg topo-cursor-${tool}${edgeStart ? ' drawing-edge' : ''}`}
          onMouseMove={handleSVGMouseMove}
          onMouseUp={handleSVGMouseUp}
          onClick={handleSVGClick}
        >
          {/* Dot grid */}
          <defs>
            <pattern id="topo-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r="1.2" fill="var(--topo-grid-dot)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo-grid)" />

          {/* Edges */}
          {edges.map((edge, i) => {
            const [x1, y1] = getQubitPos(edge[0]);
            const [x2, y2] = getQubitPos(edge[1]);
            return (
              <g key={i} onClick={(e) => handleEdgeClick(e, i)} className="topo-edge-group">
                {/* Invisible thick hit area */}
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="transparent" strokeWidth="16"
                  style={{ cursor: tool === 'delete' ? 'pointer' : 'default' }}
                />
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  className={`topo-edge ${tool === 'delete' ? 'deletable' : ''}`}
                />
              </g>
            );
          })}

          {/* Ghost edge while drawing */}
          {ghostEdge && (
            <line
              x1={ghostEdge.x1} y1={ghostEdge.y1}
              x2={ghostEdge.x2} y2={ghostEdge.y2}
              className="topo-ghost-edge"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Qubit nodes */}
          {qubits.map((q) => {
            const [x, y] = q.topoPos || [80, 80];
            const isEdgeStart = edgeStart === q.id;
            const isHovered = hoveredQubit === q.id;
            return (
              <g
                key={q.id}
                className={`topo-node ${isEdgeStart ? 'edge-start' : ''} ${tool === 'delete' ? 'deletable' : ''}`}
                onMouseDown={(e) => handleNodeMouseDown(e, q.id)}
                onMouseEnter={() => setHoveredQubit(q.id)}
                onMouseLeave={() => setHoveredQubit(null)}
                style={{ cursor: tool === 'select' ? 'grab' : tool === 'delete' ? 'pointer' : 'pointer' }}
              >
                {/* Outer glow ring for edge-start */}
                {isEdgeStart && (
                  <circle cx={x} cy={y} r={NODE_RADIUS + 8} className="topo-node-pulse" />
                )}
                <circle cx={x} cy={y} r={NODE_RADIUS} className="topo-node-circle" />
                <text x={x} y={y} className="topo-node-label" textAnchor="middle" dominantBaseline="central">
                  {q.name.replace('Qubit ', 'q')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Save modal */}
      {saveModalOpen && (
        <div className="topo-modal-backdrop" onClick={() => setSaveModalOpen(false)}>
          <div className="topo-modal" onClick={e => e.stopPropagation()}>
            <div className="topo-modal-title">Save circuit shape</div>
            <input
              className="topo-modal-input"
              placeholder="Shape name…"
              value={shapeName}
              onChange={e => setShapeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <div className="topo-modal-actions">
              <button className="topo-modal-cancel" onClick={() => setSaveModalOpen(false)}>Cancel</button>
              <button className="topo-modal-confirm" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}