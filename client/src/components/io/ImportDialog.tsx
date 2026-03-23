import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../api/client.js';

interface ImportDialogProps {
  connectionId: string;
  db: string;
  collection: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportDialog({ connectionId, db, collection, onClose, onImported }: ImportDialogProps) {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [mode, setMode] = useState<'upload' | 'path'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) setFile(droppedFile);
    },
    []
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  }, []);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setResult(null);

    try {
      let importResult: { imported: number };

      if (mode === 'upload' && file) {
        importResult = await api.importFromFile(file, connectionId, db, collection, format);
      } else if (mode === 'path' && filePath.trim()) {
        importResult = await api.importFromPath({
          connectionId,
          db,
          collection,
          format,
          filePath: filePath.trim(),
        });
      } else {
        toast.error(mode === 'upload' ? 'Please select a file' : 'Please enter a file path');
        setImporting(false);
        return;
      }

      setResult({ success: true, message: `Imported ${importResult.imported} document(s)` });
      toast.success(`Imported ${importResult.imported} document(s)`);
      onImported();
    } catch (err: any) {
      setResult({ success: false, message: err.message });
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }, [mode, file, filePath, connectionId, db, collection, format, onImported]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">Import to {collection}</div>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__body">
          <div className="form-group">
            <label className="form-label">Format</label>
            <div className="io-dialog__format-row">
              <button
                className={`io-dialog__format-btn ${format === 'json' ? 'io-dialog__format-btn--active' : ''}`}
                onClick={() => setFormat('json')}
              >
                JSON
              </button>
              <button
                className={`io-dialog__format-btn ${format === 'csv' ? 'io-dialog__format-btn--active' : ''}`}
                onClick={() => setFormat('csv')}
              >
                CSV
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Source</label>
            <div className="io-dialog__mode-toggle">
              <button
                className={`io-dialog__mode-btn ${mode === 'upload' ? 'io-dialog__mode-btn--active' : ''}`}
                onClick={() => setMode('upload')}
              >
                Upload File
              </button>
              <button
                className={`io-dialog__mode-btn ${mode === 'path' ? 'io-dialog__mode-btn--active' : ''}`}
                onClick={() => setMode('path')}
              >
                Local File Path
              </button>
            </div>
          </div>

          {mode === 'upload' ? (
            <div
              className={`io-dialog__drop-zone ${dragOver ? 'io-dialog__drop-zone--dragover' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="io-dialog__drop-zone-text">
                {file ? '' : 'Drag & drop a file here, or click to browse'}
              </div>
              {file && <div className="io-dialog__file-name">{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
              <input
                ref={fileInputRef}
                type="file"
                accept={format === 'json' ? '.json' : '.csv'}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="form-group">
              <input
                className="form-input form-input--mono"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="C:\data\export.json"
              />
            </div>
          )}

          {result && (
            <div
              className={`io-dialog__result ${
                result.success ? 'io-dialog__result--success' : 'io-dialog__result--error'
              }`}
            >
              {result.message}
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handleImport}
            disabled={importing || (mode === 'upload' && !file) || (mode === 'path' && !filePath.trim())}
          >
            {importing ? (
              <>
                <span className="spinner spinner--sm" /> Importing...
              </>
            ) : (
              'Import'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
