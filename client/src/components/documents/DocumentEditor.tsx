import { useState, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { toast } from 'react-toastify';
import { api } from '../../api/client.js';

interface DocumentEditorProps {
  mode: 'insert' | 'edit';
  connectionId: string;
  db: string;
  collection: string;
  document?: any;
  onClose: () => void;
  onSaved: () => void;
}

export function DocumentEditor({
  mode,
  connectionId,
  db,
  collection,
  document: existingDoc,
  onClose,
  onSaved,
}: DocumentEditorProps) {
  const initialValue =
    mode === 'edit' && existingDoc
      ? JSON.stringify(existingDoc, null, 2)
      : '{\n  \n}';

  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setError(null);
    let parsed: any;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError('Invalid JSON. Please fix syntax errors before saving.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'edit' && existingDoc) {
        await api.updateDocument(connectionId, db, collection, String(existingDoc._id), parsed);
        toast.success('Document updated');
      } else {
        const docs = Array.isArray(parsed) ? parsed : [parsed];
        const result = await api.insertDocuments(connectionId, db, collection, docs);
        toast.success(`Inserted ${result.insertedCount} document(s)`);
      }
      onSaved();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [value, mode, existingDoc, connectionId, db, collection, onSaved]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, handleSave]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">
            {mode === 'edit' ? 'Edit Document' : 'Insert Document'}
          </div>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__body" style={{ padding: 0, overflow: 'hidden' }}>
          <Editor
            height="100%"
            defaultLanguage="json"
            value={value}
            theme="vs-dark"
            onChange={(v) => setValue(v || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              wrappingIndent: 'indent',
              automaticLayout: true,
              padding: { top: 10 },
              tabSize: 2,
            }}
          />
        </div>

        {error && (
          <div style={{ padding: '6px 18px' }}>
            <div className="io-dialog__result io-dialog__result--error">{error}</div>
          </div>
        )}

        <div className="modal__footer">
          <span className="text-muted" style={{ fontSize: 11, marginRight: 'auto' }}>
            Ctrl+S to save
          </span>
          <button className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <span className="spinner spinner--sm" /> Saving...
              </>
            ) : mode === 'edit' ? (
              'Update'
            ) : (
              'Insert'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
