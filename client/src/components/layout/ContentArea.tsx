import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../stores/app-store.js';
import { api } from '../../api/client.js';
import { Toolbar } from './Toolbar.js';
import { QueryBar } from '../documents/QueryBar.js';
import { DocumentViewer } from '../documents/DocumentViewer.js';
import { IndexViewer } from '../indexes/IndexViewer.js';

export function ContentArea() {
  const selectedConnection = useAppStore((s) => s.selectedConnection);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const selectedCollection = useAppStore((s) => s.selectedCollection);
  const theme = useAppStore((s) => s.theme);

  const [activeTab, setActiveTab] = useState<'documents' | 'indexes'>('documents');
  const [docCount, setDocCount] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Fetch doc count when collection changes (with abort to prevent stale updates)
  useEffect(() => {
    if (!selectedConnection || !selectedDatabase || !selectedCollection) {
      setDocCount(null);
      return;
    }
    const abortController = new AbortController();
    api
      .countDocuments(selectedConnection, selectedDatabase, selectedCollection, undefined, abortController.signal)
      .then((r) => {
        if (!abortController.signal.aborted) setDocCount(r.count);
      })
      .catch(() => {
        if (!abortController.signal.aborted) setDocCount(null);
      });
    return () => { abortController.abort(); };
  }, [selectedConnection, selectedDatabase, selectedCollection, refreshKey]);

  // Reset tab when collection changes
  useEffect(() => {
    setActiveTab('documents');
  }, [selectedCollection]);

  if (!selectedConnection || !selectedDatabase || !selectedCollection) {
    return (
      <div className="welcome">
        <img src={theme === 'dark' ? '/logo-light.png' : '/logo-transparent.png'} alt="Mongo-ose" className="welcome__logo" />
        <div className="welcome__title">Mongo-ose</div>
        <div className="welcome__subtitle">
          Select a collection from the sidebar to browse documents, manage indexes, and more.
        </div>
        <div className="welcome__subtitle">
          Use the <span className="welcome__shortcut">+</span> button in the sidebar to add a new connection.
        </div>
      </div>
    );
  }

  return (
    <>
      <Toolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        docCount={docCount}
        onRefresh={triggerRefresh}
      />
      {activeTab === 'documents' ? (
        <>
          <DocumentViewer
            connectionId={selectedConnection}
            db={selectedDatabase}
            collection={selectedCollection}
            refreshKey={refreshKey}
            onRefresh={triggerRefresh}
          />
        </>
      ) : (
        <IndexViewer
          connectionId={selectedConnection}
          db={selectedDatabase}
          collection={selectedCollection}
          refreshKey={refreshKey}
        />
      )}
    </>
  );
}
