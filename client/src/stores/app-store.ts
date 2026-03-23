import { create } from 'zustand';
import type { SavedConnection, DocumentClipboard, TreeNode } from '../types/index.js';

type Theme = 'dark' | 'light';

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('mongoose-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'dark';
}

interface AppState {
  connections: SavedConnection[];
  activeConnections: string[];
  selectedConnection: string | null;
  selectedDatabase: string | null;
  selectedCollection: string | null;
  clipboard: DocumentClipboard | null;
  treeData: TreeNode[];
  theme: Theme;

  setConnections: (connections: SavedConnection[]) => void;
  addConnection: (connection: SavedConnection) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, data: Partial<SavedConnection>) => void;
  toggleConnection: (id: string) => void;
  select: (connectionId: string | null, db?: string | null, col?: string | null) => void;
  setClipboard: (clipboard: DocumentClipboard | null) => void;
  clearClipboard: () => void;
  setTreeData: (treeData: TreeNode[]) => void;
  updateTreeNode: (nodeId: string, updates: Partial<TreeNode>) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  toggleTheme: () => void;
}

function updateNodeRecursive(nodes: TreeNode[], nodeId: string, updates: Partial<TreeNode>): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    if (node.children) {
      return { ...node, children: updateNodeRecursive(node.children, nodeId, updates) };
    }
    return node;
  });
}

export const useAppStore = create<AppState>((set) => ({
  connections: [],
  activeConnections: [],
  selectedConnection: null,
  selectedDatabase: null,
  selectedCollection: null,
  clipboard: null,
  treeData: [],
  theme: getStoredTheme(),

  setConnections: (connections) => set({ connections }),

  addConnection: (connection) =>
    set((state) => ({
      connections: [...state.connections, connection],
      treeData: [
        ...state.treeData,
        {
          type: 'connection' as const,
          id: connection.id,
          name: connection.name,
          connectionId: connection.id,
          expanded: false,
          connected: false,
          children: [],
        },
      ],
    })),

  removeConnection: (id) =>
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
      activeConnections: state.activeConnections.filter((cid) => cid !== id),
      treeData: state.treeData.filter((n) => n.connectionId !== id),
      selectedConnection: state.selectedConnection === id ? null : state.selectedConnection,
      selectedDatabase: state.selectedConnection === id ? null : state.selectedDatabase,
      selectedCollection: state.selectedConnection === id ? null : state.selectedCollection,
    })),

  updateConnection: (id, data) =>
    set((state) => ({
      connections: state.connections.map((c) => (c.id === id ? { ...c, ...data } : c)),
      treeData: state.treeData.map((n) =>
        n.id === id && n.type === 'connection' ? { ...n, name: data.name || n.name } : n
      ),
    })),

  toggleConnection: (id) =>
    set((state) => {
      const isActive = state.activeConnections.includes(id);
      return {
        activeConnections: isActive
          ? state.activeConnections.filter((cid) => cid !== id)
          : [...state.activeConnections, id],
        treeData: updateNodeRecursive(state.treeData, id, { connected: !isActive }),
      };
    }),

  select: (connectionId, db = null, col = null) =>
    set({
      selectedConnection: connectionId,
      selectedDatabase: db ?? null,
      selectedCollection: col ?? null,
    }),

  setClipboard: (clipboard) => set({ clipboard }),

  clearClipboard: () => set({ clipboard: null }),

  setTreeData: (treeData) => set({ treeData }),

  updateTreeNode: (nodeId, updates) =>
    set((state) => ({
      treeData: updateNodeRecursive(state.treeData, nodeId, updates),
    })),

  expandNode: (nodeId) =>
    set((state) => ({
      treeData: updateNodeRecursive(state.treeData, nodeId, { expanded: true }),
    })),

  collapseNode: (nodeId) =>
    set((state) => ({
      treeData: updateNodeRecursive(state.treeData, nodeId, { expanded: false }),
    })),

  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('mongoose-theme', next);
      } catch {
        // localStorage unavailable
      }
      return { theme: next };
    }),
}));
