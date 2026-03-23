import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../api/client.js';

interface ExportDialogProps {
  connectionId: string;
  db: string;
  collection: string;
  onClose: () => void;
}

export function ExportDialog({ connectionId, db, collection, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [outputPath, setOutputPath] = useState('');
  const [filter, setFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setResult(null);

    try {
      let parsedFilter = {};
      if (filter.trim()) {
        parsedFilter = JSON.parse(filter);
      }

      const data = {
        connectionId,
        db,
        collection,
        format,
        filter: parsedFilter,
        outputPath: outputPath.trim() || undefined,
      };

      const exportResult = await api.exportCollection(data);

      if (exportResult instanceof Blob) {
        // Download through browser
        const url = URL.createObjectURL(exportResult);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${collection}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setResult({ success: true, message: `Downloaded ${collection}.${format}` });
      } else {
        setResult({
          success: true,
          message: `Exported ${exportResult.count} documents to ${exportResult.path}`,
        });
      }

      toast.success('Export completed');
    } catch (err: any) {
      setResult({ success: false, message: err.message });
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }, [connectionId, db, collection, format, outputPath, filter]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">Export Collection</div>
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
            <label className="form-label">Save to file path (optional -- leave empty to download)</label>
            <input
              className="form-input form-input--mono"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="C:\exports\data.json"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Filter (optional -- export subset)</label>
            <input
              className="form-input form-input--mono"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder='{ "status": "active" }'
            />
          </div>

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
          <button className="btn btn--primary" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <span className="spinner spinner--sm" /> Exporting...
              </>
            ) : (
              'Export'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
