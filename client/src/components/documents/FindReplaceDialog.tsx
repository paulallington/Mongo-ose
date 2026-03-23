import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../api/client.js';
import type { FieldInfo } from '../../types/index.js';

interface FindReplaceDialogProps {
  connectionId: string;
  db: string;
  collection: string;
  onClose: () => void;
  onReplaced: () => void;
}

export function FindReplaceDialog({ connectionId, db, collection, onClose, onReplaced }: FindReplaceDialogProps) {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [field, setField] = useState('');
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);

  useEffect(() => {
    api.scanFields(connectionId, db, collection)
      .then((r) => setFields(r.fields))
      .catch(() => {});
  }, [connectionId, db, collection]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const parseValue = (val: string) => {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  };

  const handlePreview = async () => {
    setError(null);
    if (!field || !findValue) {
      setError('Field and find value are required');
      return;
    }
    try {
      const filter = { [field]: parseValue(findValue) };
      const result = await api.countDocuments(connectionId, db, collection, filter);
      setPreview(result.count);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReplace = async () => {
    setError(null);
    if (!field) {
      setError('Field is required');
      return;
    }

    setReplacing(true);
    try {
      const result = await api.findAndReplace(
        connectionId, db, collection,
        field, parseValue(findValue), parseValue(replaceValue)
      );
      toast.success(`Replaced in ${result.modifiedCount} of ${result.matchedCount} document(s)`);
      onReplaced();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal__header">
          <div className="modal__title">Find & Replace</div>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Field</label>
            <select
              className="form-input"
              value={field}
              onChange={(e) => { setField(e.target.value); setPreview(null); }}
            >
              <option value="">Select a field...</option>
              {fields.filter(f => f.path !== '_id').map((f) => (
                <option key={f.path} value={f.path}>{f.path} ({f.type})</option>
              ))}
            </select>
            {!fields.length && (
              <input
                className="form-input form-input--mono"
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="field.path"
                style={{ marginTop: 4 }}
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Find value</label>
            <input
              className="form-input form-input--mono"
              value={findValue}
              onChange={(e) => { setFindValue(e.target.value); setPreview(null); }}
              placeholder='value or "string" or 123'
            />
          </div>

          <div className="form-group">
            <label className="form-label">Replace with</label>
            <input
              className="form-input form-input--mono"
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.target.value)}
              placeholder='new value'
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn--secondary btn--sm" onClick={handlePreview} disabled={!field || !findValue}>
              Preview Count
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
          <button className="btn btn--primary" onClick={handleReplace} disabled={replacing || !field}>
            {replacing ? <><span className="spinner spinner--sm" /> Replacing...</> : 'Replace All'}
          </button>
        </div>
      </div>
    </div>
  );
}
