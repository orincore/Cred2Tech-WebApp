import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getUsers } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import { getInitials } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import OrgCard from '../components/OrgCard';
import TravelingBorderButton from '../components/TravelingBorderButton';
import UserSidePanel from '../components/UserSidePanel';
import PageHeader from '../components/ui/PageHeader';

// Responsive hook
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { isMobile };
};

// ─── Layout helpers ───────────────────────────────────────────
const NODE_W = 230;
const NODE_H = 130;
const H_GAP  = 60;
const V_GAP  = 70;

const buildTree = (users) => {
  const map = {};
  const roots = [];
  
  // First pass: create map with all users
  users.forEach((u) => {
    map[u.id] = { ...u, _children: [] };
  });

  // Second pass: build hierarchy using manager_id first, then hierarchy_path as fallback
  users.forEach((u) => {
    // Try manager_id first
    if (u.manager_id && map[u.manager_id]) {
      map[u.manager_id]._children.push(map[u.id]);
    } 
    // Fallback: use hierarchy_path to determine parent
    else if (u.hierarchy_path && u.hierarchy_path !== '/' && u.hierarchy_path !== '') {
      // Parse hierarchy_path like '/3/4/' to find parent
      const pathParts = u.hierarchy_path.split('/').filter(p => p !== '');
      if (pathParts.length > 1) {
        // Parent is the second-to-last path component (last is current user)
        const parentId = parseInt(pathParts[pathParts.length - 2]);
        if (parentId && map[parentId]) {
          map[parentId]._children.push(map[u.id]);
          return;
        }
      }
      // If only one part in path, it's a root under the org
      roots.push(map[u.id]);
    }
    // No manager_id and no valid hierarchy_path -> root
    else {
      roots.push(map[u.id]);
    }
  });

  return roots;
};

// Assign x/y positions to each node via tree layout
// Uses a two-pass approach: 1) compute subtree widths bottom-up, 2) assign positions top-down
const layoutTree = (nodes, startX = 0, startY = 0) => {
  const positioned = [];

  // Pass 1: compute subtree widths bottom-up
  const computeWidth = (node) => {
    if (!node._children || node._children.length === 0) {
      node._subtreeWidth = NODE_W;
      return NODE_W;
    }
    const childWidths = node._children.map(c => computeWidth(c));
    const totalWidth = childWidths.reduce((s, w) => s + w, 0) + H_GAP * (node._children.length - 1);
    node._subtreeWidth = Math.max(NODE_W, totalWidth);
    return node._subtreeWidth;
  };

  nodes.forEach(root => computeWidth(root));

  // Pass 2: assign positions top-down
  const assignPos = (node, x, y) => {
    const result = { ...node, x, y };
    positioned.push(result);

    if (!node._children || node._children.length === 0) {
      return;
    }

    // Total width of all children
    const totalChildrenWidth = node._children.reduce((s, c) => s + c._subtreeWidth, 0) + H_GAP * (node._children.length - 1);

    // Center children under the parent
    // Start from parent's x minus half of children's total width
    let cx = x - totalChildrenWidth / 2;

    node._children.forEach(child => {
      const childX = cx + child._subtreeWidth / 2;
      const childY = y + NODE_H + V_GAP;
      assignPos(child, childX, childY);
      cx += child._subtreeWidth + H_GAP;
    });
  };

  // Position each root tree side by side
  let cx = startX;
  nodes.forEach((root) => {
    const rootX = cx + root._subtreeWidth / 2;
    assignPos(root, rootX, startY);
    cx += root._subtreeWidth + H_GAP * 3; // extra gap between separate trees
  });

  return positioned;
};

// ─── Role colors ──────────────────────────────────────────────
const roleColor = (role) => {
  if (!role) return '#64748b';
  const r = typeof role === 'object' ? (role?.name || role?.id || '') : role;
  const upper = (r || '').toUpperCase();
  if (upper.includes('SUPER')) return '#7c3aed';
  if (upper.includes('DSA_ADMIN') || upper.includes('ADMIN')) return '#4f46e5';
  if (upper.includes('MEMBER') || upper.includes('EMPLOYEE')) return '#0891b2';
  if (upper.includes('DSA')) return '#f59e0b';
  return '#64748b';
};

const roleBg = (role) => roleColor(role) + '18';
const formatRole = (r) => {
  const roleName = typeof r === 'object' ? (r?.name || r?.id || 'Member') : (r || 'Member');
  return roleName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};
const shortCode = (name) => (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);

// ─── Straight + curved connector (orthogonal with rounded corner) ─
const Edge = ({ parent, child, isDark }) => {
  const x1 = parent.x;
  const y1 = parent.y + NODE_H; // Start from bottom of card
  const x2 = child.x;
  const y2 = child.y; // End at the top of the child card

  // Small straight segment before curving
  const straightLen = 15;
  const curveStartY = y1 + straightLen;

  // Calculate midpoint for the elbow/rounded corner (after the straight segment)
  const midY = curveStartY + (y2 - curveStartY) / 2;

  // Create path: small straight -> rounded corner -> straight horizontal -> rounded corner -> straight down
  const cornerRadius = 12;
  
  // Direction: if child is to the right or left
  const goingRight = x2 > x1;
  const r = Math.min(cornerRadius, Math.abs(x2 - x1) / 2, Math.abs(y2 - curveStartY) / 4);
  
  // Path: small straight down, then curve to horizontal, horizontal, curve down to child
  const path = goingRight 
    ? `M${x1},${y1} L${x1},${curveStartY} L${x1},${midY - r} Q${x1},${midY} ${x1 + r},${midY} L${x2 - r},${midY} Q${x2},${midY} ${x2},${midY + r} L${x2},${y2}`
    : `M${x1},${y1} L${x1},${curveStartY} L${x1},${midY - r} Q${x1},${midY} ${x1 - r},${midY} L${x2 + r},${midY} Q${x2},${midY} ${x2},${midY + r} L${x2},${y2}`;

  // Theme-aware colors
  const lineColor = isDark ? '#64748b' : '#94a3b8';
  const arrowColor = 'var(--on-muted)';

  return (
    <g>
      <defs>
        <marker id={`arrowhead-${isDark ? 'dark' : 'light'}`} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <polygon points="0 0, 10 5, 0 10" fill={arrowColor} />
        </marker>
      </defs>
      {/* Straight + rounded corner path with arrow */}
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        markerEnd={`url(#arrowhead-${isDark ? 'dark' : 'light'})`}
      />
      {/* Small dot at the parent junction point */}
      <circle cx={x1} cy={y1} r={3} fill={lineColor} />
      {/* Dot at the child junction point */}
      <circle cx={x2} cy={y2} r={3} fill={lineColor} />
    </g>
  );
};

// ─── Dot Pattern Background Component ─────────────────────────
const DotPattern = ({ isDark }) => (
  <defs>
    <pattern id="dotPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="1.5" fill={isDark ? '#334155' : '#cbd5e1'} />
    </pattern>
  </defs>
);

// ─── Main HierarchyPage ───────────────────────────────────────
const HierarchyPage = () => {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const canvasRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(new Set()); // Will populate after data loads
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'list'
  const dragRef = useRef(false);
  const panRef = useRef(pan);
  panRef.current = pan;

  // Toggle expand/collapse for a node
  const toggleExpand = useCallback((nodeId) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getUsers();
        const userData = Array.isArray(data) ? data : data.users || MOCK_USERS;
        setUsers(userData);
        // Auto-expand all nodes with children on initial load
        const allIds = new Set();
        const addWithChildren = (nodes) => {
          nodes.forEach(n => {
            if (n._children?.length > 0) {
              allIds.add(n.id);
              addWithChildren(n._children);
            }
          });
        };
        const treeData = buildTree(userData);
        addWithChildren(treeData);
        setExpanded(allIds);
      } catch {
        setUsers(MOCK_USERS);
        const treeData = buildTree(MOCK_USERS);
        const allIds = new Set();
        const addWithChildren = (nodes) => {
          nodes.forEach(n => {
            if (n._children?.length > 0) {
              allIds.add(n.id);
              addWithChildren(n._children);
            }
          });
        };
        addWithChildren(treeData);
        setExpanded(allIds);
      }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // Build tree and filter based on expanded state
  const tree = buildTree(users);

  // Create map of original children counts before filtering
  const originalChildCountMap = {};
  const countChildren = (nodes) => {
    nodes.forEach(n => {
      originalChildCountMap[n.id] = n._children?.length || 0;
      if (n._children) countChildren(n._children);
    });
  };
  countChildren(tree);

  // Filter nodes: only include nodes whose all ancestors are expanded
  const isNodeVisible = (node, ancestorsExpanded = true) => {
    if (!ancestorsExpanded) return false;
    // Check if all ancestors are expanded by traversing up through manager_id/hierarchy
    return true; // Root nodes are always visible
  };

  // Recursively filter nodes based on expanded state
  const filterNodes = (nodes, parentExpanded = true) => {
    const result = [];
    nodes.forEach(n => {
      // This node is visible if parent is expanded
      if (parentExpanded) {
        result.push(n);
        // Only include children if this node is expanded
        if (expanded.has(n.id) && n._children) {
          result.push(...filterNodes(n._children, true));
        }
      }
    });
    return result;
  };

  // Build filtered tree: only include children if parent is expanded
  const buildFilteredTree = (nodes, parentExpanded = true) => {
    return nodes.map(n => ({
      ...n,
      _children: (parentExpanded && expanded.has(n.id) && n._children) 
        ? buildFilteredTree(n._children, true) 
        : []
    }));
  };

  const filteredTree = buildFilteredTree(tree, true);
  const posNodes = layoutTree(filteredTree, 300, 40);

  // Map id → posNode for edge lookup
  const nodeMap = {};
  posNodes.forEach(n => { nodeMap[n.id] = n; });

  // Edges: only for visible (expanded) parent→child pairs
  const edges = [];
  posNodes.forEach(n => {
    if (expanded.has(n.id) && n._children) {
      n._children.forEach(c => {
        if (nodeMap[c.id]) edges.push({ parent: n, child: nodeMap[c.id] });
      });
    }
  });

  // Canvas bounds
  const minX = posNodes.length ? Math.min(...posNodes.map(n => n.x - NODE_W / 2)) - 60 : 0;
  const maxX = posNodes.length ? Math.max(...posNodes.map(n => n.x + NODE_W / 2)) + 60 : 800;
  const maxY = posNodes.length ? Math.max(...posNodes.map(n => n.y + NODE_H)) + 100 : 600;
  const svgW = Math.max(maxX - minX, 800);
  const svgH = Math.max(maxY, 600);

  // ── Drag handlers ──
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragRef.current = true;
    setDragging(true);
    setDragStart({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y });
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragStart]);

  const onMouseUp = useCallback(() => {
    dragRef.current = false;
    setDragging(false);
  }, []);

  // Touch support
  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    dragRef.current = true;
    setDragStart({ x: t.clientX - panRef.current.x, y: t.clientY - panRef.current.y });
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragRef.current) return;
    const t = e.touches[0];
    setPan({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  }, [dragStart]);

  // ── Zoom wheel (smooth zoom toward cursor) ──
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Smoother zoom factor
    const delta = -e.deltaY * 0.001;
    
    requestAnimationFrame(() => {
      setZoom(z => {
        // Smoother exponential zoom
        const zoomFactor = Math.exp(delta);
        const newZoom = Math.min(2.5, Math.max(0.2, z * zoomFactor));
        const scale = newZoom / z;
        
        // Zoom toward mouse position
        setPan(p => ({
          x: mouseX - scale * (mouseX - p.x),
          y: mouseY - scale * (mouseY - p.y),
        }));
        
        return newZoom;
      });
    });
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Minimap scale
  const MM_W = 140, MM_H = 90;
  const mmScaleX = MM_W / svgW;
  const mmScaleY = MM_H / svgH;

  const formatRoleText = (r) => (r?.name || r || 'Member').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>

      {/* ─── Top header ─── */}
      <div style={{ padding: isMobile ? '80px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader title="Hierarchy Management" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', padding: 3, borderRadius: 8, border: '1px solid var(--outline)' }}>
            <button
              onClick={() => setViewMode('tree')}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: viewMode === 'tree' ? '#4f46e5' : 'transparent',
                color: viewMode === 'tree' ? '#fff' : 'var(--on-muted)',
              }}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: viewMode === 'list' ? '#4f46e5' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--on-muted)',
              }}
            >
              List
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>{users.length} members</span>
          <button
            onClick={() => navigate('/users/create')}
            style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            + Add Member
          </button>
        </div>
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-muted)', fontSize: 14 }}>Loading hierarchy…</div>
      ) : users.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--on-muted)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>No users found</p>
          <p style={{ fontSize: 13, margin: '6px 0 0' }}>No hierarchy data available.</p>
        </div>
      ) : viewMode === 'tree' ? (
        /* ─── Tree View ─── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Canvas */}
          <div
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={() => { dragRef.current = false; }}
            onClick={() => setSelected(null)}
            style={{ flex: 1, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', position: 'relative', background: isDark ? '#0f172a' : '#f8fafc' }}
          >
            <svg
              width="100%" height="100%"
              style={{ display: 'block' }}
            >
              <DotPattern isDark={isDark} />
              {/* Background rect with dot pattern */}
              <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#dotPattern)" opacity="0.6" />
              
              <g
                transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
                style={{ transition: dragging ? 'none' : 'transform 0.15s ease-out' }}
              >
                {/* Edges */}
                {edges.map((e, i) => <Edge key={i} parent={e.parent} child={e.child} isDark={isDark} />)}
                {/* Nodes */}
                {posNodes.map((n) => (
                  <OrgCard
                    key={n.id}
                    node={n}
                    selected={selected}
                    onClick={setSelected}
                    navigate={navigate}
                    expanded={expanded}
                    onToggle={toggleExpand}
                    originalChildCount={originalChildCountMap[n.id] || 0}
                  />
                ))}
              </g>
            </svg>
          </div>

          {/* ── Zoom controls ── */}
          <div style={{ position: 'absolute', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            <div style={{ height: 1, background: 'var(--outline)' }} />
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>−</button>
            <div style={{ height: 1, background: 'var(--outline)' }} />
            <button onClick={() => { setZoom(1); setPan({ x: 80, y: 60 }); }} style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, color: 'var(--on-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{Math.round(zoom * 100)}%</button>
          </div>

          {/* ── Minimap ── */}
          {!loading && posNodes.length > 0 && (
            <div style={{ position: 'absolute', bottom: 24, left: 24, width: MM_W + 2, height: MM_H + 2, border: '1px solid var(--outline)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)', opacity: 0.92 }}>
              <svg width={MM_W} height={MM_H}>
                <g transform={`scale(${mmScaleX},${mmScaleY})`}>
                  {edges.map((e, i) => (
                    <line key={i} x1={e.parent.x} y1={e.parent.y + NODE_H / 2} x2={e.child.x} y2={e.child.y} stroke="#cbd5e1" strokeWidth="3" />
                  ))}
                  {posNodes.map((n) => (
                    <rect key={n.id} x={n.x - NODE_W / 2} y={n.y} width={NODE_W} height={NODE_H} rx="4" fill={selected?.id === n.id ? roleColor(n.role) : '#e2e8f0'} />
                  ))}
                </g>
                {/* Viewport indicator */}
                <rect
                  x={Math.max(0, (-pan.x / zoom) * mmScaleX)}
                  y={Math.max(0, (-pan.y / zoom) * mmScaleY)}
                  width={Math.min(MM_W, (canvasRef.current?.clientWidth || 600) / zoom * mmScaleX)}
                  height={Math.min(MM_H, (canvasRef.current?.clientHeight || 400) / zoom * mmScaleY)}
                  fill="rgba(79,70,229,0.08)" stroke="#4f46e5" strokeWidth="1" rx="2"
                />
              </svg>
            </div>
          )}

          {/* ── Side panel ── */}
          <UserSidePanel
            selected={selected}
            onClose={() => setSelected(null)}
            navigate={navigate}
            children={{ onClickChild: (c) => setSelected(nodeMap[c.id] || c) }}
          />
        </div>
      ) : (
        /* ─── List View (matches UsersListPage table style) ─── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Table Container */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
            {/* Sub-header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Team Information</span>
              <span style={{ fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>{users.length} members</span>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto', width: '100%' }}>
              <table style={{ width: isMobile ? '800px' : '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
                <colgroup><col style={{ width: '22%' }} /><col style={{ width: '12%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%' }} /></colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--outline)', position: 'sticky', top: 0, zIndex: 10 }}>
                    {['Name', 'Role', 'Designation', 'Mobile', 'Email', 'Level', 'Status'].map(h => (
                      <th key={h} style={{
                        padding: '11px 10px', fontSize: 10, fontWeight: 800, color: 'var(--on-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        textAlign: 'left',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => {
                    const isActive = (u.status || 'ACTIVE') === 'ACTIVE';
                    const isLast = idx === users.length - 1;
                    const color = roleColor(u.role);

                    return (
                      <tr key={u.id}
                        onClick={() => setSelected(u)}
                        style={{ borderBottom: isLast ? 'none' : '1px solid var(--outline)', background: selected?.id === u.id ? 'var(--surface)' : 'var(--bg)', transition: 'background 0.12s', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                        onMouseLeave={e => e.currentTarget.style.background = selected?.id === u.id ? 'var(--surface)' : 'var(--bg)'}
                      >
                        {/* Name */}
                        <td style={{ padding: '14px 10px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: roleBg(u.role), color: color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 800,
                            }}>
                              {getInitials(u.name)}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.name || '—'}
                            </span>
                          </div>
                        </td>

                        {/* Role */}
                        <td style={{ padding: '14px 10px', overflow: 'hidden' }}>
                          <span style={{
                            background: roleBg(u.role), color: color,
                            padding: '3px 8px', borderRadius: 4,
                            fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                          }}>
                            {formatRole(u.role)}
                          </span>
                        </td>

                        {/* Designation */}
                        <td style={{ padding: '14px 10px', fontSize: 12, color: 'var(--on-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.designation || '—'}
                        </td>

                        {/* Mobile */}
                        <td style={{ padding: '14px 10px', fontSize: 12, color: 'var(--on-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.mobile || '—'}
                        </td>

                        {/* Email */}
                        <td style={{ padding: '14px 10px', fontSize: 12, color: 'var(--on-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.email || '—'}
                        </td>

                        {/* Hierarchy Level */}
                        <td style={{ padding: '14px 10px', overflow: 'hidden' }}>
                          <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {u.hierarchy_level || 'Root'}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#10b981' : '#f43f5e', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#10b981' : '#f43f5e', whiteSpace: 'nowrap' }}>
                              {u.status || 'ACTIVE'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Side panel ── */}
          <UserSidePanel
            selected={selected}
            onClose={() => setSelected(null)}
            navigate={navigate}
            children={{ onClickChild: (c) => setSelected(c) }}
          />
        </div>
      )}
    </div>
  );
};

export default HierarchyPage;
