import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useContextMenu } from 'react-contexify';
import type { TreeNode } from '../../types/index.js';
import { api } from '../../api/client.js';
import { useAppStore } from '../../stores/app-store.js';
import { TreeContextMenu } from './TreeContextMenu.js';

interface DatabaseTreeProps {
  onNewConnection: () => void;
}

const CONN_MENU_ID = 'tree-connection-menu';
const DB_MENU_ID = 'tree-database-menu';
const COL_MENU_ID = 'tree-collection-menu';

export function DatabaseTree({ onNewConnection }: DatabaseTreeProps) {
  const treeData = useAppStore((s) => s.treeData);
  const activeConnections = useAppStore((s) => s.activeConnections);
  const selectedConnection = useAppStore((s) => s.selectedConnection);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const selectedCollection = useAppStore((s) => s.selectedCollection);
  const select = useAppStore((s) => s.select);
  const toggleConnection = useAppStore((s) => s.toggleConnection);
  const expandNode = useAppStore((s) => s.expandNode);
  const collapseNode = useAppStore((s) => s.collapseNode);
  const updateTreeNode = useAppStore((s) => s.updateTreeNode);

  const { show: showConnMenu } = useContextMenu({ id: CONN_MENU_ID });
  const { show: showDbMenu } = useContextMenu({ id: DB_MENU_ID });
  const { show: showColMenu } = useContextMenu({ id: COL_MENU_ID });

  const loadDatabases = useCallback(
    async (connId: string) => {
      try {
        updateTreeNode(connId, { children: [{ type: 'database', id: `${connId}/__loading__`, name: 'Loading...', connectionId: connId }] });
        const result = await api.getDatabases(connId);
        const dbNodes: TreeNode[] = result.databases
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((db) => ({
            type: 'database' as const,
            id: `${connId}/${db.name}`,
            name: db.name,
            connectionId: connId,
            dbName: db.name,
            expanded: false,
            children: [],
          }));
        updateTreeNode(connId, { children: dbNodes, expanded: true });
      } catch (err: any) {
        toast.error(`Failed to load databases: ${err.message}`);
        updateTreeNode(connId, { children: [] });
      }
    },
    [updateTreeNode]
  );

  const loadCollections = useCallback(
    async (connId: string, dbName: string) => {
      const nodeId = `${connId}/${dbName}`;
      try {
        updateTreeNode(nodeId, { children: [{ type: 'collection', id: `${nodeId}/__loading__`, name: 'Loading...', connectionId: connId, dbName }] });
        const result = await api.getCollections(connId, dbName);
        const colNodes: TreeNode[] = result.collections
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((col) => ({
            type: 'collection' as const,
            id: `${connId}/${dbName}/${col.name}`,
            name: col.name,
            connectionId: connId,
            dbName,
          }));
        updateTreeNode(nodeId, { children: colNodes, expanded: true });
      } catch (err: any) {
        toast.error(`Failed to load collections: ${err.message}`);
        updateTreeNode(nodeId, { children: [] });
      }
    },
    [updateTreeNode]
  );

  const handleConnClick = useCallback(
    async (node: TreeNode) => {
      const isActive = activeConnections.includes(node.connectionId);
      if (!isActive) {
        try {
          await api.connect(node.connectionId);
          toggleConnection(node.connectionId);
          await loadDatabases(node.connectionId);
        } catch (err: any) {
          toast.error(`Connection failed: ${err.message}`);
        }
      } else {
        if (node.expanded) {
          collapseNode(node.id);
        } else {
          expandNode(node.id);
        }
      }
    },
    [activeConnections, toggleConnection, loadDatabases, expandNode, collapseNode]
  );

  const handleDbClick = useCallback(
    async (node: TreeNode) => {
      if (node.expanded) {
        collapseNode(node.id);
      } else {
        await loadCollections(node.connectionId, node.dbName!);
      }
    },
    [loadCollections, collapseNode]
  );

  const handleColClick = useCallback(
    (node: TreeNode) => {
      select(node.connectionId, node.dbName!, node.name);
    },
    [select]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: TreeNode) => {
      e.preventDefault();
      const props = { node, loadDatabases, loadCollections };
      switch (node.type) {
        case 'connection':
          showConnMenu({ event: e, props });
          break;
        case 'database':
          showDbMenu({ event: e, props });
          break;
        case 'collection':
          showColMenu({ event: e, props });
          break;
      }
    },
    [showConnMenu, showDbMenu, showColMenu, loadDatabases, loadCollections]
  );

  const isSelected = (node: TreeNode) => {
    if (node.type === 'collection') {
      return (
        node.connectionId === selectedConnection &&
        node.dbName === selectedDatabase &&
        node.name === selectedCollection
      );
    }
    return false;
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isLoading = node.id.endsWith('/__loading__');
    if (isLoading) {
      return (
        <div key={node.id} className="tree-loading" style={{ paddingLeft: depth * 16 + 24 }}>
          <span className="spinner spinner--sm" /> Loading...
        </div>
      );
    }

    const isConn = node.type === 'connection';
    const isDb = node.type === 'database';
    const isCol = node.type === 'collection';
    const isActive = isConn && activeConnections.includes(node.connectionId);
    const hasChildren = node.children && node.children.length > 0;
    const connData = isConn ? useAppStore.getState().connections.find((c) => c.id === node.connectionId) : null;

    return (
      <div key={node.id} className="tree-node">
        <div
          className={`tree-node__row ${isSelected(node) ? 'tree-node__row--selected' : ''} ${
            isConn && !isActive ? 'tree-node__row--disconnected' : ''
          }`}
          style={{ paddingLeft: depth * 16 + 4 }}
          onClick={() => {
            if (isConn) handleConnClick(node);
            else if (isDb) handleDbClick(node);
            else if (isCol) handleColClick(node);
          }}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          <div className="tree-node__toggle">
            {(isConn || isDb) ? (
              <span className={node.expanded ? 'tree-node__toggle--expanded' : ''}>
                &#9654;
              </span>
            ) : (
              <span style={{ width: 18 }} />
            )}
          </div>

          {isConn && connData?.color && (
            <div className="tree-node__color-dot" style={{ backgroundColor: connData.color }} />
          )}

          <div
            className={`tree-node__icon ${
              isConn
                ? 'tree-node__icon--connection'
                : isDb
                ? 'tree-node__icon--database'
                : 'tree-node__icon--collection'
            }`}
          >
            {isConn ? '\u2699' : isDb ? '\uD83D\uDDC3' : '\uD83D\uDCC4'}
          </div>

          <span className="tree-node__label">{node.name}</span>

          {isConn && (
            <span
              className={`tree-node__status ${
                isActive ? 'tree-node__status--connected' : 'tree-node__status--disconnected'
              }`}
            >
              {isActive ? 'connected' : 'disconnected'}
            </span>
          )}
        </div>

        {node.expanded && hasChildren && (
          <div className="tree-node__children">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {treeData.length === 0 ? (
        <div style={{ padding: '20px 14px', textAlign: 'center' }}>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            No connections yet
          </div>
          <button className="btn btn--primary btn--sm" onClick={onNewConnection}>
            + Add Connection
          </button>
        </div>
      ) : (
        treeData.map((node) => renderNode(node, 0))
      )}
      <TreeContextMenu
        connMenuId={CONN_MENU_ID}
        dbMenuId={DB_MENU_ID}
        colMenuId={COL_MENU_ID}
      />
    </>
  );
}
