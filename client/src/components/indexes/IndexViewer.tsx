import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import type { IndexInfo } from '../../types/index.js';
import { api } from '../../api/client.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.js';

interface IndexViewerProps {
  connectionId: string;
  db: string;
  collection: string;
  refreshKey: number;
}

interface IndexFieldRow {
  name: string;
  direction: string;
}

export function IndexViewer({ connectionId, db, collection, refreshKey }: IndexViewerProps) {
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [fields, setFields] = useState<IndexFieldRow[]>([{ name: '', direction: '1' }]);
  const [optUnique, setOptUnique] = useState(false);
  const [optSparse, setOptSparse] = useState(false);
  const [ttl, setTtl] = useState('');
  const [creating, setCreating] = useState(false);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchIndexes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getIndexes(connectionId, db, collection);
      setIndexes(result.indexes);
    } catch (err: any) {
      toast.error(`Failed to load indexes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, db, collection]);

  useEffect(() => {
    fetchIndexes();
  }, [fetchIndexes, refreshKey]);

  const handleAddField = () => {
    setFields((prev) => [...prev, { name: '', direction: '1' }]);
  };

  const handleRemoveField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFieldChange = (idx: number, key: 'name' | 'direction', val: string) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: val } : f)));
  };

  const handleCreate = async () => {
    const validFields = fields.filter((f) => f.name.trim());
    if (validFields.length === 0) {
      toast.error('At least one index field is required');
      return;
    }

    const keys: Record<string, number> = {};
    for (const f of validFields) {
      keys[f.name.trim()] = Number(f.direction);
    }

    const options: Record<string, any> = {};
    if (optUnique) options.unique = true;
    if (optSparse) options.sparse = true;
    if (ttl.trim()) options.expireAfterSeconds = Number(ttl);

    setCreating(true);
    try {
      const result = await api.createIndex(connectionId, db, collection, keys, options);
      toast.success(`Index "${result.name}" created`);
      setShowCreate(false);
      resetCreateForm();
      fetchIndexes();
    } catch (err: any) {
      toast.error(`Create index failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDrop = async (name: string) => {
    try {
      await api.dropIndex(connectionId, db, collection, name);
      toast.success(`Index "${name}" dropped`);
      fetchIndexes();
    } catch (err: any) {
      toast.error(`Drop index failed: ${err.message}`);
    }
    setDeleteTarget(null);
  };

  const resetCreateForm = () => {
    setFields([{ name: '', direction: '1' }]);
    setOptUnique(false);
    setOptSparse(false);
    setTtl('');
  };

  return (
    <div className="index-viewer">
      <div className="index-viewer__header">
        <h3>Indexes</h3>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn--primary btn--sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? 'Cancel' : '+ Create Index'}
        </button>
        <button className="btn btn--ghost btn--sm btn--icon" onClick={fetchIndexes} title="Refresh">
          &#8635;
        </button>
      </div>

      {showCreate && (
        <div className="index-create-form">
          <div className="index-create-form__title">New Index</div>

          <div className="index-create-form__fields">
            {fields.map((field, idx) => (
              <div key={idx} className="index-create-form__field-row">
                <input
                  className="form-input form-input--mono"
                  placeholder="Field name"
                  value={field.name}
                  onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                />
                <select
                  className="form-select"
                  value={field.direction}
                  onChange={(e) => handleFieldChange(idx, 'direction', e.target.value)}
                >
                  <option value="1">Ascending (1)</option>
                  <option value="-1">Descending (-1)</option>
                  <option value="text">Text</option>
                  <option value="2dsphere">2dsphere</option>
                </select>
                {fields.length > 1 && (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleRemoveField(idx)}
                    title="Remove field"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button className="btn btn--ghost btn--sm" onClick={handleAddField}>
              + Add Field
            </button>
          </div>

          <div className="index-create-form__options">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={optUnique}
                onChange={(e) => setOptUnique(e.target.checked)}
              />
              Unique
            </label>
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={optSparse}
                onChange={(e) => setOptSparse(e.target.checked)}
              />
              Sparse
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="text-secondary" style={{ fontSize: 12 }}>TTL (seconds):</span>
              <input
                className="form-input form-input--mono"
                style={{ width: 100 }}
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
                placeholder="e.g. 3600"
              />
            </div>
          </div>

          <div className="index-create-form__actions">
            <button className="btn btn--primary" onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <span className="spinner spinner--sm" /> Creating...
                </>
              ) : (
                'Create Index'
              )}
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="index-viewer__table-wrap">
        {loading ? (
          <div className="loading-overlay">
            <span className="spinner" />
            Loading indexes...
          </div>
        ) : indexes.length === 0 ? (
          <div className="loading-overlay">
            <span className="text-muted">No indexes found</span>
          </div>
        ) : (
          <table className="index-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Keys</th>
                <th>Properties</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {indexes.map((index) => (
                <tr key={index.name}>
                  <td>
                    <span style={{ fontWeight: 500 }}>{index.name}</span>
                  </td>
                  <td>
                    {Object.entries(index.key).map(([k, v]) => (
                      <span key={k} style={{ marginRight: 8 }}>
                        {k}: <span className="text-accent">{v}</span>
                      </span>
                    ))}
                  </td>
                  <td>
                    {index.unique && <span className="index-badge index-badge--unique">unique</span>}{' '}
                    {index.sparse && <span className="index-badge index-badge--sparse">sparse</span>}{' '}
                    {index.expireAfterSeconds != null && (
                      <span className="index-badge index-badge--ttl">
                        TTL: {index.expireAfterSeconds}s
                      </span>
                    )}
                  </td>
                  <td>
                    {index.name !== '_id_' && (
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => setDeleteTarget(index.name)}
                      >
                        Drop
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Drop Index"
          message={`Are you sure you want to drop the index "${deleteTarget}"? This may impact query performance.`}
          onConfirm={() => handleDrop(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
