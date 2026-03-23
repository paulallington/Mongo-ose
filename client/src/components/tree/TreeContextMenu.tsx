import { useState } from 'react';
import { Menu, Item, Separator } from 'react-contexify';
import { toast } from 'react-toastify';
import type { TreeNode } from '../../types/index.js';
import { api } from '../../api/client.js';
import { useAppStore } from '../../stores/app-store.js';
import { ConnectionManager } from '../connections/ConnectionManager.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.js';
import { ExportDialog } from '../io/ExportDialog.js';
import { ImportDialog } from '../io/ImportDialog.js';
import { CopyPasteDialog } from '../transfer/CopyPasteDialog.js';

interface TreeContextMenuProps {
  connMenuId: string;
  dbMenuId: string;
  colMenuId: string;
}

export function TreeContextMenu({ connMenuId, dbMenuId, colMenuId }: TreeContextMenuProps) {
  const activeConnections = useAppStore((s) => s.activeConnections);
  const toggleConnection = useAppStore((s) => s.toggleConnection);
  const removeConnection = useAppStore((s) => s.removeConnection);
  const select = useAppStore((s) => s.select);
  const clipboard = useAppStore((s) => s.clipboard);
  const setClipboard = useAppStore((s) => s.setClipboard);

  const [editConn, setEditConn] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [exportTarget, setExportTarget] = useState<{ connId: string; db: string; col: string } | null>(null);
  const [importTarget, setImportTarget] = useState<{ connId: string; db: string; col: string } | null>(null);
  const [pasteTarget, setPasteTarget] = useState<{ connId: string; db: string; col: string } | null>(null);

  // ------- Connection menu handlers -------
  const handleConnect = async ({ props }: any) => {
    const node: TreeNode = props.node;
    try {
      await api.connect(node.connectionId);
      toggleConnection(node.connectionId);
      await props.loadDatabases(node.connectionId);
      toast.success('Connected');
    } catch (err: any) {
      toast.error(`Connection failed: ${err.message}`);
    }
  };

  const handleDisconnect = async ({ props }: any) => {
    const node: TreeNode = props.node;
    try {
      await api.disconnect(node.connectionId);
      toggleConnection(node.connectionId);
      // If the selected connection is this one, deselect
      const state = useAppStore.getState();
      if (state.selectedConnection === node.connectionId) {
        select(null);
      }
      toast.success('Disconnected');
    } catch (err: any) {
      toast.error(`Disconnect failed: ${err.message}`);
    }
  };

  const handleEditConn = ({ props }: any) => {
    const node: TreeNode = props.node;
    const conn = useAppStore.getState().connections.find((c) => c.id === node.connectionId);
    if (conn) setEditConn(conn);
  };

  const handleRefreshConn = async ({ props }: any) => {
    const node: TreeNode = props.node;
    await props.loadDatabases(node.connectionId);
  };

  const handleDeleteConn = ({ props }: any) => {
    const node: TreeNode = props.node;
    setConfirmDialog({
      title: 'Delete Connection',
      message: `Are you sure you want to delete "${node.name}"? This will remove the saved connection.`,
      onConfirm: async () => {
        try {
          await api.deleteConnection(node.connectionId);
          removeConnection(node.connectionId);
          toast.success('Connection deleted');
        } catch (err: any) {
          toast.error(`Delete failed: ${err.message}`);
        }
        setConfirmDialog(null);
      },
    });
  };

  // ------- Database menu handlers -------
  const handleRefreshDb = async ({ props }: any) => {
    const node: TreeNode = props.node;
    await props.loadCollections(node.connectionId, node.dbName!);
  };

  const handleDropDb = ({ props }: any) => {
    const node: TreeNode = props.node;
    setConfirmDialog({
      title: 'Drop Database',
      message: `Are you sure you want to drop database "${node.dbName}"? This action is irreversible and will delete ALL data in this database.`,
      onConfirm: async () => {
        try {
          await api.findDocuments(node.connectionId, node.dbName!, '', {});
          // There's no drop database API defined, so we'll show a message
          toast.error('Drop database is not yet supported via the API');
        } catch {
          toast.error('Drop database is not yet supported via the API');
        }
        setConfirmDialog(null);
      },
    });
  };

  // ------- Collection menu handlers -------
  const handleViewDocs = ({ props }: any) => {
    const node: TreeNode = props.node;
    select(node.connectionId, node.dbName!, node.name);
  };

  const handleViewIndexes = ({ props }: any) => {
    const node: TreeNode = props.node;
    select(node.connectionId, node.dbName!, node.name);
    // The tab switch is handled by the ContentArea component based on selection
  };

  const handleExportCol = ({ props }: any) => {
    const node: TreeNode = props.node;
    setExportTarget({ connId: node.connectionId, db: node.dbName!, col: node.name });
  };

  const handleImportCol = ({ props }: any) => {
    const node: TreeNode = props.node;
    setImportTarget({ connId: node.connectionId, db: node.dbName!, col: node.name });
  };

  const handleCopyAll = async ({ props }: any) => {
    const node: TreeNode = props.node;
    try {
      const result = await api.findDocuments(node.connectionId, node.dbName!, node.name, {
        filter: {},
        limit: 10000,
        skip: 0,
      });
      setClipboard({
        documents: result.documents,
        sourceConnectionId: node.connectionId,
        sourceDb: node.dbName!,
        sourceCollection: node.name,
        operation: 'copy',
      });
      toast.success(`${result.documents.length} documents copied to clipboard`);
    } catch (err: any) {
      toast.error(`Copy failed: ${err.message}`);
    }
  };

  const handlePaste = ({ props }: any) => {
    const node: TreeNode = props.node;
    setPasteTarget({ connId: node.connectionId, db: node.dbName!, col: node.name });
  };

  const handleDropCol = ({ props }: any) => {
    const node: TreeNode = props.node;
    setConfirmDialog({
      title: 'Drop Collection',
      message: `Are you sure you want to drop collection "${node.name}"? This action is irreversible and will delete ALL documents.`,
      onConfirm: async () => {
        try {
          toast.error('Drop collection is not yet supported via the API');
        } catch {
          // noop
        }
        setConfirmDialog(null);
      },
    });
  };

  return (
    <>
      {/* Connection Context Menu */}
      <Menu id={connMenuId}>
        <Item
          onClick={handleConnect}
          hidden={({ props }: any) => activeConnections.includes(props?.node?.connectionId)}
        >
          <span className="ctx-icon">&#9889;</span> Connect
        </Item>
        <Item
          onClick={handleDisconnect}
          hidden={({ props }: any) => !activeConnections.includes(props?.node?.connectionId)}
        >
          <span className="ctx-icon">&#10005;</span> Disconnect
        </Item>
        <Separator />
        <Item onClick={handleEditConn}>
          <span className="ctx-icon">&#9998;</span> Edit Connection
        </Item>
        <Item
          onClick={handleRefreshConn}
          disabled={({ props }: any) => !activeConnections.includes(props?.node?.connectionId)}
        >
          <span className="ctx-icon">&#8635;</span> Refresh
        </Item>
        <Separator />
        <Item onClick={handleDeleteConn}>
          <span className="ctx-icon ctx-danger">&#128465;</span>
          <span className="ctx-danger">Delete Connection</span>
        </Item>
      </Menu>

      {/* Database Context Menu */}
      <Menu id={dbMenuId}>
        <Item onClick={handleRefreshDb}>
          <span className="ctx-icon">&#8635;</span> Refresh
        </Item>
        <Separator />
        <Item onClick={handleDropDb}>
          <span className="ctx-icon ctx-danger">&#128465;</span>
          <span className="ctx-danger">Drop Database</span>
        </Item>
      </Menu>

      {/* Collection Context Menu */}
      <Menu id={colMenuId}>
        <Item onClick={handleViewDocs}>
          <span className="ctx-icon">&#128196;</span> View Documents
        </Item>
        <Item onClick={handleViewIndexes}>
          <span className="ctx-icon">&#128209;</span> View Indexes
        </Item>
        <Separator />
        <Item onClick={handleExportCol}>
          <span className="ctx-icon">&#11015;</span> Export
        </Item>
        <Item onClick={handleImportCol}>
          <span className="ctx-icon">&#11014;</span> Import
        </Item>
        <Separator />
        <Item onClick={handleCopyAll}>
          <span className="ctx-icon">&#128203;</span> Copy All Documents
        </Item>
        <Item onClick={handlePaste} disabled={() => !clipboard}>
          <span className="ctx-icon">&#128203;</span> Paste Documents {clipboard ? `(${clipboard.documents.length})` : ''}
        </Item>
        <Separator />
        <Item onClick={handleDropCol}>
          <span className="ctx-icon ctx-danger">&#128465;</span>
          <span className="ctx-danger">Drop Collection</span>
        </Item>
      </Menu>

      {/* Modals triggered by context menu */}
      {editConn && (
        <ConnectionManager
          editConnection={editConn}
          onClose={() => setEditConn(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {exportTarget && (
        <ExportDialog
          connectionId={exportTarget.connId}
          db={exportTarget.db}
          collection={exportTarget.col}
          onClose={() => setExportTarget(null)}
        />
      )}

      {importTarget && (
        <ImportDialog
          connectionId={importTarget.connId}
          db={importTarget.db}
          collection={importTarget.col}
          onClose={() => setImportTarget(null)}
          onImported={() => setImportTarget(null)}
        />
      )}

      {pasteTarget && clipboard && (
        <CopyPasteDialog
          clipboard={clipboard}
          targetConnectionId={pasteTarget.connId}
          targetDb={pasteTarget.db}
          targetCollection={pasteTarget.col}
          onClose={() => setPasteTarget(null)}
          onPasted={() => setPasteTarget(null)}
        />
      )}
    </>
  );
}
