import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../api/client.js';
import { useAppStore } from '../../stores/app-store.js';
import { QueryBar } from './QueryBar.js';
import { DocumentTable, extractId } from './DocumentTable.js';
import { DocumentJson } from './DocumentJson.js';
import { DocumentEditor } from './DocumentEditor.js';
import { DocumentContextMenu } from './DocumentContextMenu.js';
import { Pagination } from './Pagination.js';
import { CopyPasteDialog } from '../transfer/CopyPasteDialog.js';
import { BulkUpdateDialog } from './BulkUpdateDialog.js';
import { DeleteByFilterDialog } from './DeleteByFilterDialog.js';
import { FindReplaceDialog } from './FindReplaceDialog.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.js';

interface DocumentViewerProps {
  connectionId: string;
  db: string;
  collection: string;
  refreshKey: number;
  onRefresh: () => void;
}

export function DocumentViewer({
  connectionId,
  db,
  collection,
  refreshKey,
  onRefresh,
}: DocumentViewerProps) {
  const clipboard = useAppStore((s) => s.clipboard);
  const setClipboard = useAppStore((s) => s.setClipboard);

  const [documents, setDocuments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Query state
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [projection, setProjection] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Editor state
  const [editDoc, setEditDoc] = useState<any>(null);
  const [showInsert, setShowInsert] = useState(false);

  // Paste dialog
  const [showPaste, setShowPaste] = useState(false);
  // Bulk operations
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [showDeleteByFilter, setShowDeleteByFilter] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);

  // Track the context menu target doc
  const contextDocRef = useRef<any>(null);

  // Fetch documents with AbortController to prevent stale responses
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchDocuments() {
      setLoading(true);
      try {
        const parsedFilter = filter.trim() ? JSON.parse(filter) : {};
        const parsedSort = sort.trim() ? JSON.parse(sort) : undefined;
        const parsedProjection = projection.trim() ? JSON.parse(projection) : undefined;

        const result = await api.findDocuments(connectionId, db, collection, {
          filter: parsedFilter,
          sort: parsedSort,
          projection: parsedProjection,
          skip: (page - 1) * pageSize,
          limit: pageSize,
        }, abortController.signal);

        if (!abortController.signal.aborted) {
          setDocuments(result.documents);
          setTotal(result.total);
        }
      } catch (err: any) {
        if (abortController.signal.aborted) return;
        toast.error(`Query failed: ${err.message}`);
        setDocuments([]);
        setTotal(0);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchDocuments();

    return () => {
      abortController.abort();
    };
  }, [connectionId, db, collection, filter, sort, projection, page, pageSize, refreshKey]);

  // Reset page when collection changes
  useEffect(() => {
    setPage(1);
    setFilter('');
    setSort('');
    setProjection('');
    setSelectedIds(new Set());
  }, [connectionId, db, collection]);

  const handleExecuteQuery = useCallback(
    (f: string, s: string, p: string) => {
      setFilter(f);
      setSort(s);
      setProjection(p);
      setPage(1);
    },
    []
  );

  const handleResetQuery = useCallback(() => {
    setFilter('');
    setSort('');
    setProjection('');
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(multi ? prev : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(documents.map((d) => extractId(d._id))));
      } else {
        setSelectedIds(new Set());
      }
    },
    [documents]
  );

  const handleEdit = useCallback((doc: any) => {
    setEditDoc(doc);
  }, []);

  const handleDelete = useCallback(
    async (ids: string[]) => {
      try {
        const result = await api.deleteDocuments(connectionId, db, collection, ids);
        toast.success(`Deleted ${result.deletedCount} document(s)`);
        setSelectedIds(new Set());
        onRefresh();
      } catch (err: any) {
        toast.error(`Delete failed: ${err.message}`);
      }
    },
    [connectionId, db, collection, onRefresh]
  );

  const handleDuplicate = useCallback(
    async (doc: any) => {
      try {
        const clone = { ...doc };
        delete clone._id;
        await api.insertDocuments(connectionId, db, collection, [clone]);
        toast.success('Document duplicated');
        onRefresh();
      } catch (err: any) {
        toast.error(`Duplicate failed: ${err.message}`);
      }
    },
    [connectionId, db, collection, onRefresh]
  );

  const handleCopyToClipboard = useCallback(
    (docs: any[]) => {
      setClipboard({
        documents: docs,
        sourceConnectionId: connectionId,
        sourceDb: db,
        sourceCollection: collection,
        operation: 'copy',
      });
      toast.success(`${docs.length} document(s) copied to clipboard`);
    },
    [connectionId, db, collection, setClipboard]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs/editors
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.closest('.monaco-editor')) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        e.preventDefault();
        setShowPaste(true);
      }
      if (e.key === 'Delete' && selectedIds.size > 0) {
        e.preventDefault();
        setConfirmDeleteIds(Array.from(selectedIds));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clipboard, selectedIds]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <QueryBar
        onExecute={handleExecuteQuery}
        onReset={handleResetQuery}
        count={total}
        loading={loading}
        connectionId={connectionId}
        db={db}
        collection={collection}
      />

      <div className="document-viewer">
        <div className="document-viewer__toolbar">
          <div className="document-viewer__view-toggle">
            <button
              className={`document-viewer__view-btn ${viewMode === 'table' ? 'document-viewer__view-btn--active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
            <button
              className={`document-viewer__view-btn ${viewMode === 'json' ? 'document-viewer__view-btn--active' : ''}`}
              onClick={() => setViewMode('json')}
            >
              JSON
            </button>
          </div>

          {selectedIds.size > 0 && (
            <span className="document-viewer__selected-info">
              {selectedIds.size} selected
            </span>
          )}

          <div className="document-viewer__bulk-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => setShowBulkUpdate(true)} title="Bulk Update">
              Update Many
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowDeleteByFilter(true)} title="Delete by Filter">
              Delete by Filter
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowFindReplace(true)} title="Find & Replace">
              Find & Replace
            </button>
          </div>
        </div>

        {loading && documents.length === 0 ? (
          <div className="loading-overlay">
            <span className="spinner" />
            Loading documents...
          </div>
        ) : viewMode === 'table' ? (
          <DocumentTable
            documents={documents}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onEdit={handleEdit}
            contextDocRef={contextDocRef}
            connectionId={connectionId}
            db={db}
            collection={collection}
            onRefresh={onRefresh}
          />
        ) : (
          <DocumentJson documents={documents} />
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          total={total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRefresh={onRefresh}
        />
      </div>

      <DocumentContextMenu
        contextDocRef={contextDocRef}
        selectedIds={selectedIds}
        documents={documents}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onCopy={handleCopyToClipboard}
      />

      {editDoc && (
        <DocumentEditor
          mode="edit"
          connectionId={connectionId}
          db={db}
          collection={collection}
          document={editDoc}
          onClose={() => setEditDoc(null)}
          onSaved={() => {
            setEditDoc(null);
            onRefresh();
          }}
        />
      )}

      {showInsert && (
        <DocumentEditor
          mode="insert"
          connectionId={connectionId}
          db={db}
          collection={collection}
          onClose={() => setShowInsert(false)}
          onSaved={() => {
            setShowInsert(false);
            onRefresh();
          }}
        />
      )}

      {showPaste && clipboard && (
        <CopyPasteDialog
          clipboard={clipboard}
          targetConnectionId={connectionId}
          targetDb={db}
          targetCollection={collection}
          onClose={() => setShowPaste(false)}
          onPasted={() => {
            setShowPaste(false);
            onRefresh();
          }}
        />
      )}

      {showBulkUpdate && (
        <BulkUpdateDialog
          connectionId={connectionId}
          db={db}
          collection={collection}
          initialFilter={filter}
          onClose={() => setShowBulkUpdate(false)}
          onUpdated={() => {
            setShowBulkUpdate(false);
            onRefresh();
          }}
        />
      )}

      {showDeleteByFilter && (
        <DeleteByFilterDialog
          connectionId={connectionId}
          db={db}
          collection={collection}
          initialFilter={filter}
          onClose={() => setShowDeleteByFilter(false)}
          onDeleted={() => {
            setShowDeleteByFilter(false);
            onRefresh();
          }}
        />
      )}

      {showFindReplace && (
        <FindReplaceDialog
          connectionId={connectionId}
          db={db}
          collection={collection}
          onClose={() => setShowFindReplace(false)}
          onReplaced={() => {
            setShowFindReplace(false);
            onRefresh();
          }}
        />
      )}

      {confirmDeleteIds && (
        <ConfirmDialog
          title="Delete Document(s)"
          message={`Are you sure you want to delete ${confirmDeleteIds.length} document(s)? This action cannot be undone.`}
          onConfirm={() => {
            handleDelete(confirmDeleteIds);
            setConfirmDeleteIds(null);
          }}
          onCancel={() => setConfirmDeleteIds(null)}
        />
      )}
    </>
  );
}
