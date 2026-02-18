import { useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import Sidebar from './components/Sidebar/Sidebar';
import BlochSphere from './components/BlochSphere/BlochSphere';
import './App.css';

function App() {
  const [qubits, setQubits] = useState([
    { id: 1, name: 'Qubit 1', rotation: new THREE.Quaternion(), position: [0, 0, 0], groupId: null }
  ]);

  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);

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

  const createGroup = useCallback((parentId = null) => {
    const newId = Date.now();
    const newGroup = { id: newId, name: `Group ${groups.length + 1}`, parentId };
    setGroups(prev => [...prev, newGroup]);
    setSelected({ type: 'group', id: newId });
  }, [groups.length]);

  const moveGroup = useCallback((groupId, newParentId) => {
    if (newParentId !== null) {
      const subtree = getSubtreeGroupIds(groupId);
      if (subtree.includes(newParentId)) return; // cycle
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

  return (
    <div className="app-layout">
      <Sidebar
        qubits={qubits}
        groups={groups}
        selected={selected}
        onSelect={setSelected}
        onAddQubit={(targetGroupId = null) => {
          const newId = Date.now();
          const offset = qubits.length * 2.5;
          const newQubit = {
            id: newId,
            name: `Qubit ${qubits.length + 1}`,
            rotation: new THREE.Quaternion(),
            position: [offset, 0, 0],
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

      <main className="main-content">
        <BlochSphere
          qubits={qubits}
          selected={selected}
          highlightedIds={highlightedQubitIds}
          onSelect={setSelected}
        />
      </main>
    </div>
  );
}

export default App;