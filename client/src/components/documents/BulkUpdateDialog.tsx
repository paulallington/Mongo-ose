import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { toast } from 'react-toastify';
import { api } from '../../api/client.js';

interface BulkUpdateDialogProps {
  connectionId: string;
  db: string;
  collection: string;
  initialFilter?: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function BulkUpdateDialog({ connectionId, db, collection, initialFilter, onClose, onUpdated }: BulkUpdateDialogProps) {
  const [filter, setFilter] = useState(initialFilter || '{}');
  const [update, setUpdate] = useState('{ "$set": { "field": "value" } }');
  const [preview, setPreview] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);
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
      const result = await api.countDocuments(connectionId, db, collection, parsedFilter);
      setPreview(result.count);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    setError(null);
    let parsedFilter: any;
    let parsedUpdate: any;
    try {
      parsedFilter = JSON.parse(filter);
    } catch {
      setError('Invalid filter JSON');
      return;
    }
    try {
      parsedUpdate = JSON.parse(update);
    } catch {
      setError('Invalid update JSON');
      return;
    }

    setUpdating(true);
    try {
      const result = await api.updateMany(connectionId, db, collection, parsedFilter, parsedUpdate);
      toast.success(`Updated ${result.modifiedCount} of ${result.matchedCount} matched document(s)`);
      onUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">Bulk Update</div>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Filter (which documents to update)</label>
            <div style={{ height: 100, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={filter}
                theme="vs-dark"
                onChange={(v) => setFilter(v || '{}')}
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

          <div className="form-group">
            <label className="form-label">Update expression</label>
            <div style={{ height: 120, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={update}
                theme="vs-dark"
                onChange={(v) => setUpdate(v || '')}
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
            <button className="btn btn--secondary btn--sm" onClick={handlePreview}>
              Preview Match Count
            </button>
            {preview !== null && (
              <span className="text-muted" style={{ fontSize: 12 }}>
                {preview.toLocaleString()} document(s) match
              </span>
            )}
          </div>

          {error && (
            <div className="io-dialog__result io-dialog__result--error">{error}</div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleUpdate} disabled={updating}>
            {updating ? <><span className="spinner spinner--sm" /> Updating...</> : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
