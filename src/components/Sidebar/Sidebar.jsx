import React, { useState } from 'react';
import Accordion from '../UI/Accordion';
import DefaultRotation from './menus/DefaultRotation';
import CustomRotation from './menus/CustomRotation';
import QuantumGates from './menus/QuantumGates';
import './Sidebar.css';

function getSubtreeGroupIds(startId, allGroups) {
  const ids = new Set([startId]);
  let added = true;
  while (added) {
    added = false;
    for (const g of allGroups) {
      if (g.parentId !== null && ids.has(g.parentId) && !ids.has(g.id)) {
        ids.add(g.id);
        added = true;
      }
    }
  }
  return Array.from(ids);
}

const Folder = ({
  group,
  groups,
  qubits,
  expanded,
  toggleExpanded,
  onSelect,
  onUpdateQubit,
  onMoveGroup,
  depth = 0
}) => {
  const childGroups = groups.filter(g => g.parentId === group.id);
  const directQubits = qubits.filter(q => q.groupId === group.id);
  const isExpanded = expanded.has(group.id);

  return (
    <div
      className="folder-container"
      style={{ paddingLeft: `${depth * 20}px` }}
    >
      <div
        className="folder-header"
        draggable
        onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', id: group.id }))}
        onClick={() => onSelect({ type: 'group', id: group.id })}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data.type === 'qubit') onUpdateQubit(data.id, { groupId: group.id });
          else if (data.type === 'group') onMoveGroup(data.id, group.id);
        }}
      >
        <span
          className="toggle"
          onClick={e => { e.stopPropagation(); toggleExpanded(group.id); }}
        >
          {isExpanded ? '▼' : '▶'}
        </span>
        📁 {group.name}
      </div>

      {isExpanded && (
        <>
          <ul className="file-list">
            {directQubits.map(q => (
              <li
                key={q.id}
                draggable
                onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'qubit', id: q.id }))}
                onClick={() => onSelect({ type: 'qubit', id: q.id })}
              >
                📄 {q.name}
              </li>
            ))}
          </ul>

          {childGroups.map(child => (
            <Folder
              key={child.id}
              group={child}
              groups={groups}
              qubits={qubits}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              onSelect={onSelect}
              onUpdateQubit={onUpdateQubit}
              onMoveGroup={onMoveGroup}
              depth={depth + 1}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default function Sidebar({
  qubits,
  groups,
  selected,
  onSelect,
  onAddQubit,
  onCreateGroup,
  onUpdateQubit,
  onUpdateGroup,
  onMoveGroup,
  onGroupPositionChange,
  onDeleteGroup
}) {
  const [activeMenu, setActiveMenu] = useState('default');
  const [expanded, setExpanded] = useState(new Set());

  const toggleMenu = (menu) => setActiveMenu(activeMenu === menu ? null : menu);
  const toggleExpanded = (id) => {
    const newSet = new Set(expanded);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpanded(newSet);
  };

  const rootGroups = groups.filter(g => g.parentId === null);
  const ungrouped = qubits.filter(q => q.groupId === null);

  // ====================== TREE VIEW ======================
  if (!selected) {
    return (
      <aside className="side-menu">
        <div className="manager-header">
          <h2>Qubit Register</h2>
          <div>
            <button onClick={() => onAddQubit(null)} className="add-btn" title="New Qubit">📄</button>
            <button onClick={() => onCreateGroup(null)} className="add-btn" title="New Folder">📁</button>
          </div>
        </div>

        <div className="explorer-tree">
          {/* Ungrouped */}
          <div
            className="folder-container"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              if (data.type === 'qubit') onUpdateQubit(data.id, { groupId: null });
              else if (data.type === 'group') onMoveGroup(data.id, null);
            }}
          >
            <div className="folder-header">📁 Ungrouped</div>
            <ul className="file-list">
              {ungrouped.map(q => (
                <li
                  key={q.id}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'qubit', id: q.id }))}
                  onClick={() => onSelect({ type: 'qubit', id: q.id })}
                >
                  📄 {q.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Root folders (now properly indented) */}
          {rootGroups.map(g => (
            <Folder
              key={g.id}
              group={g}
              groups={groups}
              qubits={qubits}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              onSelect={onSelect}
              onUpdateQubit={onUpdateQubit}
              onMoveGroup={onMoveGroup}
              depth={0}
            />
          ))}
        </div>
      </aside>
    );
  }

  // ====================== INSPECTOR ======================
  const isQubit = selected.type === 'qubit';
  const selQubit = isQubit ? qubits.find(q => q.id === selected.id) : null;
  const selGroup = !isQubit ? groups.find(g => g.id === selected.id) : null;

  let subtreeQubits = [];
  if (!isQubit) {
    const subtreeIds = getSubtreeGroupIds(selected.id, groups);
    subtreeQubits = qubits.filter(q => q.groupId !== null && subtreeIds.includes(q.groupId));
  }

  return (
    <aside className="side-menu">
      <button className="back-btn" onClick={() => onSelect(null)}>← Back to Register</button>

      {isQubit ? (
        /* ... same inspector as before ... */
        <>
          <div className="inspector-header">
            <input type="text" value={selQubit.name} onChange={e => onUpdateQubit(selQubit.id, { name: e.target.value })} />
          </div>

          <div className="location-panel">
            <label>Position (X, Y, Z)</label>
            <div className="xyz-inputs">
              {[0,1,2].map(i => (
                <input key={i} type="number" step="0.5" value={selQubit.position[i]} onChange={e => {
                  const newPos = [...selQubit.position];
                  newPos[i] = parseFloat(e.target.value) || 0;
                  onUpdateQubit(selQubit.id, { position: newPos });
                }} />
              ))}
            </div>
          </div>

          <div className="group-assign">
            <label>Move to Group</label>
            <select value={selQubit.groupId || ''} onChange={e => onUpdateQubit(selQubit.id, { groupId: e.target.value ? parseInt(e.target.value) : null })}>
              <option value="">Ungrouped</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <hr className="divider" />

          <Accordion title="Euler Rotation" isOpen={activeMenu === 'default'} onToggle={() => toggleMenu('default')}>
            <DefaultRotation setRotation={rot => onUpdateQubit(selQubit.id, { rotation: rot })} />
          </Accordion>
          <Accordion title="Custom Axis" isOpen={activeMenu === 'custom'} onToggle={() => toggleMenu('custom')}>
            <CustomRotation setRotation={rot => onUpdateQubit(selQubit.id, { rotation: rot })} />
          </Accordion>
          <Accordion title="Quantum Gates" isOpen={activeMenu === 'gates'} onToggle={() => toggleMenu('gates')}>
            <QuantumGates rotation={selQubit.rotation} setRotation={rot => onUpdateQubit(selQubit.id, { rotation: rot })} />
          </Accordion>
        </>
      ) : (
        /* ... same group inspector ... */
        <>
          <div className="inspector-header">
            <input type="text" value={selGroup.name} onChange={e => onUpdateGroup(selGroup.id, { name: e.target.value })} />
          </div>

          <div className="location-panel">
            <label>Group Position (moves entire subtree)</label>
            <div className="xyz-inputs">
              {[0,1,2].map(i => (
                <input
                  key={i}
                  type="number"
                  step="0.5"
                  value={subtreeQubits.length ? (subtreeQubits.reduce((s, q) => s + (q.position[i] || 0), 0) / subtreeQubits.length).toFixed(2) : '0.00'}
                  onChange={e => onGroupPositionChange(selGroup.id, i, e.target.value)}
                />
              ))}
            </div>
          </div>

          <button onClick={() => onCreateGroup(selected.id)} style={{ margin: '10px 0' }}>+ New Subfolder</button>
          <button onClick={() => onAddQubit(selected.id)} style={{ margin: '0 0 10px 0' }}>+ Add Qubit here</button>

          <p style={{ fontSize: '0.85rem', color: '#aaa' }}>
            Members ({subtreeQubits.length}): {subtreeQubits.map(q => q.name).join(', ') || '—'}
          </p>

          <button onClick={() => onDeleteGroup(selected.id)} style={{ color: '#ff5555', marginTop: '20px' }}>
            Delete Group (ungroups all qubits, promotes children)
          </button>
        </>
      )}
    </aside>
  );
}