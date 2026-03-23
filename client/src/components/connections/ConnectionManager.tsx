import { useState } from 'react';
import { toast } from 'react-toastify';
import type { SavedConnection } from '../../types/index.js';
import { api } from '../../api/client.js';
import { useAppStore } from '../../stores/app-store.js';

interface ConnectionManagerProps {
  onClose: () => void;
  editConnection?: SavedConnection;
}

export function ConnectionManager({ onClose, editConnection }: ConnectionManagerProps) {
  const addConnection = useAppStore((s) => s.addConnection);
  const updateConnection = useAppStore((s) => s.updateConnection);

  const [name, setName] = useState(editConnection?.name || '');
  const [connectionString, setConnectionString] = useState(
    editConnection?.connectionString || 'mongodb://localhost:27017'
  );
  const [color, setColor] = useState(editConnection?.color || '#4fc3f7');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editConnection;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testConnection(connectionString);
      if (result.ok) {
        const serverVersion = result.serverInfo?.version || 'unknown';
        setTestResult({ ok: true, message: `Connection successful (MongoDB v${serverVersion})` });
      } else {
        setTestResult({ ok: false, message: result.error || 'Connection failed' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Connection name is required');
      return;
    }
    if (!connectionString.trim()) {
      toast.error('Connection string is required');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const updated = await api.updateConnection(editConnection.id, {
          name: name.trim(),
          connectionString: connectionString.trim(),
          color,
        });
        updateConnection(editConnection.id, updated);
        toast.success('Connection updated');
      } else {
        const created = await api.createConnection({
          name: name.trim(),
          connectionString: connectionString.trim(),
          color,
        });
        addConnection(created);
        toast.success('Connection created');
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-backdrop" onKeyDown={handleKeyDown} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">{isEdit ? 'Edit Connection' : 'New Connection'}</div>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__body">
          <div className="connection-form">
            <div className="form-group">
              <label className="form-label">Connection Name</label>
              <input
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My MongoDB Server"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Connection String</label>
              <input
                className="form-input form-input--mono"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="mongodb://localhost:27017"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Color (optional)</label>
              <div className="connection-form__color-row">
                <input
                  type="color"
                  className="form-color-input"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className="text-muted" style={{ fontSize: 12 }}>{color}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn--secondary"
                onClick={handleTest}
                disabled={testing || !connectionString.trim()}
              >
                {testing ? (
                  <>
                    <span className="spinner spinner--sm" /> Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`connection-form__test-result ${
                  testResult.ok
                    ? 'connection-form__test-result--success'
                    : 'connection-form__test-result--error'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <span className="spinner spinner--sm" /> Saving...
              </>
            ) : isEdit ? (
              'Update'
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
