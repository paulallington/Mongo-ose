import { useState } from 'react';
import { toast } from 'react-toastify';
import type { DocumentClipboard } from '../../types/index.js';
import { api } from '../../api/client.js';
import { useAppStore } from '../../stores/app-store.js';

interface CopyPasteDialogProps {
  clipboard: DocumentClipboard;
  targetConnectionId: string;
  targetDb: string;
  targetCollection: string;
  onClose: () => void;
  onPasted: () => void;
}

export function CopyPasteDialog({
  clipboard,
  targetConnectionId,
  targetDb,
  targetCollection,
  onClose,
  onPasted,
}: CopyPasteDialogProps) {
  const connections = useAppStore((s) => s.connections);
  const clearClipboard = useAppStore((s) => s.clearClipboard);

  const [generateNewIds, setGenerateNewIds] = useState(true);
  const [pasting, setPasting] = useState(false);

  const sourceConnName = connections.find((c) => c.id === clipboard.sourceConnectionId)?.name || clipboard.sourceConnectionId;
  const targetConnName = connections.find((c) => c.id === targetConnectionId)?.name || targetConnectionId;

  const handlePaste = async () => {
    setPasting(true);
    try {
      let documents = clipboard.documents;
      if (generateNewIds) {
        documents = documents.map((doc) => {
          const clone = { ...doc };
          delete clone._id;
          return clone;
        });
      }

      if (clipboard.sourceConnectionId === targetConnectionId) {
        // Same connection -- use direct insert
        const result = await api.insertDocuments(targetConnectionId, targetDb, targetCollection, documents);
        toast.success(`Pasted ${result.insertedCount} document(s)`);
      } else {
        // Cross-connection -- use transfer API
        const result = await api.copyDocuments({
          sourceConnectionId: clipboard.sourceConnectionId,
          sourceDb: clipboard.sourceDb,
          sourceCollection: clipboard.sourceCollection,
          targetConnectionId,
          targetDb,
          targetCollection,
          filter: {},
          generateNewIds,
        });
        toast.success(`Pasted ${result.copied} document(s)`);
      }

      if (clipboard.operation === 'cut') {
        clearClipboard();
      }
      onPasted();
    } catch (err: any) {
      toast.error(`Paste failed: ${err.message}`);
    } finally {
      setPasting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">Paste Documents</div>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__body">
          <div className="transfer-info">
            <p>
              <strong>Source:</strong>{' '}
              <span className="transfer-info__path">
                {sourceConnName} &rsaquo; {clipboard.sourceDb} &rsaquo; {clipboard.sourceCollection}
              </span>
            </p>
            <p style={{ marginTop: 4 }}>
              <strong>Documents:</strong> {clipboard.documents.length}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Target:</strong>{' '}
              <span className="transfer-info__path">
                {targetConnName} &rsaquo; {targetDb} &rsaquo; {targetCollection}
              </span>
            </p>
          </div>

          <label className="form-checkbox-row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={generateNewIds}
              onChange={(e) => setGenerateNewIds(e.target.checked)}
            />
            Generate new _id values
          </label>
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handlePaste} disabled={pasting}>
            {pasting ? (
              <>
                <span className="spinner spinner--sm" /> Pasting...
              </>
            ) : (
              `Paste ${clipboard.documents.length} Document(s)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
