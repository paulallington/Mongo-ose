import { useState } from 'react';
import { useAppStore } from '../../stores/app-store.js';
import { DocumentEditor } from '../documents/DocumentEditor.js';
import { ExportDialog } from '../io/ExportDialog.js';
import { ImportDialog } from '../io/ImportDialog.js';

interface ToolbarProps {
  activeTab: 'documents' | 'indexes';
  onTabChange: (tab: 'documents' | 'indexes') => void;
  docCount: number | null;
  onRefresh: () => void;
}

export function Toolbar({ activeTab, onTabChange, docCount, onRefresh }: ToolbarProps) {
  const selectedConnection = useAppStore((s) => s.selectedConnection);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const selectedCollection = useAppStore((s) => s.selectedCollection);
  const connections = useAppStore((s) => s.connections);

  const [showInsert, setShowInsert] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const connName = connections.find((c) => c.id === selectedConnection)?.name || '';

  return (
    <>
      <div className="toolbar">
        <div className="toolbar__breadcrumb">
          <span className="toolbar__breadcrumb-item">{connName}</span>
          {selectedDatabase && (
            <>
              <span className="toolbar__breadcrumb-sep">&rsaquo;</span>
              <span className="toolbar__breadcrumb-item">{selectedDatabase}</span>
            </>
          )}
          {selectedCollection && (
            <>
              <span className="toolbar__breadcrumb-sep">&rsaquo;</span>
              <span className="toolbar__breadcrumb-item toolbar__breadcrumb-item--active">
                {selectedCollection}
              </span>
            </>
          )}
        </div>

        {docCount !== null && (
          <span className="toolbar__stats">{docCount.toLocaleString()} docs</span>
        )}

        <div className="toolbar__spacer" />

        <div className="toolbar__tabs">
          <button
            className={`toolbar__tab ${activeTab === 'documents' ? 'toolbar__tab--active' : ''}`}
            onClick={() => onTabChange('documents')}
          >
            Documents
          </button>
          <button
            className={`toolbar__tab ${activeTab === 'indexes' ? 'toolbar__tab--active' : ''}`}
            onClick={() => onTabChange('indexes')}
          >
            Indexes
          </button>
        </div>

        <div className="toolbar__actions">
          <button className="btn btn--secondary btn--sm" onClick={() => setShowInsert(true)}>
            + Insert
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setShowExport(true)}>
            Export
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setShowImport(true)}>
            Import
          </button>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onRefresh} title="Refresh">
            &#8635;
          </button>
        </div>
      </div>

      {showInsert && selectedConnection && selectedDatabase && selectedCollection && (
        <DocumentEditor
          mode="insert"
          connectionId={selectedConnection}
          db={selectedDatabase}
          collection={selectedCollection}
          onClose={() => setShowInsert(false)}
          onSaved={() => {
            setShowInsert(false);
            onRefresh();
          }}
        />
      )}

      {showExport && selectedConnection && selectedDatabase && selectedCollection && (
        <ExportDialog
          connectionId={selectedConnection}
          db={selectedDatabase}
          collection={selectedCollection}
          onClose={() => setShowExport(false)}
        />
      )}

      {showImport && selectedConnection && selectedDatabase && selectedCollection && (
        <ImportDialog
          connectionId={selectedConnection}
          db={selectedDatabase}
          collection={selectedCollection}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
