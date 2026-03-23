import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { toast } from 'react-toastify';
import { api } from '../../api/client.js';

interface DeleteByFilterDialogProps {
  connectionId: string;
  db: string;
  collection: string;
  initialFilter?: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteByFilterDialog({ connectionId, db, collection, initialFilter, onClose, onDeleted }: DeleteByFilterDialogProps) {
  const [filter, setFilter] = useState(initialFilter || '');
  const [preview, setPreview] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handlePreview = async () => {
    setError(null);
    try {
      const parsedFilter = JSON.parse(filter);
      if (Object.keys(parsedFilter).length === 0) {
        setError('Empty filter not allowed — use Drop Collection to remove all documents');
        return;
      }
      const result = await api.countDocuments(connectionId, db, collection, parsedFilter);
      setPreview(result.count);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    setError(null);
    let parsedFilter: any;
    try {
      parsedFilter = JSON.parse(filter);
    } catch {
      setError('Invalid filter JSON');
      return;
    }
    if (Object.keys(parsedFilter).length === 0) {
      setError('Empty filter not allowed — use Drop Collection to remove all documents');
      return;
    }

    setDeleting(true);
    try {
      const result = await api.deleteManyByFilter(connectionId, db, collection, parsedFilter);
      toast.success(`Deleted ${result.deletedCount} document(s)`);
      onDeleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal__header">
          <div className="modal__title">Delete by Filter</div>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Filter (documents to delete)</label>
            <div style={{ height: 120, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={filter}
                theme="vs-dark"
                onChange={(v) => setFilter(v || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'Cascadia Code', Consolas, monospace",
                  lineNumbers: 'off',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  padding: { top: 6 },
                  tabSize: 2,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn--secondary btn--sm" onClick={handlePreview} disabled={!filter.trim()}>
              Preview Count
            </button>
            {preview !== null && (
              <span className="text-muted" style={{ fontSize: 12, color: 'var(--accent-danger)' }}>
                {preview.toLocaleString()} document(s) will be deleted
              </span>
            )}
          </div>

          {error && (
            <div className="io-dialog__result io-dialog__result--error">{error}</div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--danger" onClick={handleDelete} disabled={deleting || !filter.trim()}>
            {deleting ? <><span className="spinner spinner--sm" /> Deleting...</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
