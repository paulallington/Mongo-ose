import { useState } from 'react';
import { DatabaseTree } from '../tree/DatabaseTree.js';
import { ConnectionManager } from '../connections/ConnectionManager.js';
import { useAppStore } from '../../stores/app-store.js';

export function Sidebar() {
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-header__title">
          <span className="sidebar-header__title-icon">&#9671;</span>
          Mongo-ose
        </div>
        <div className="sidebar-header__actions">
          <button
            className="sidebar-header__add-btn"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '\u2600' : '\uD83C\uDF19'}
          </button>
          <button
            className="sidebar-header__add-btn"
            title="Add Connection"
            onClick={() => setShowConnectionModal(true)}
          >
            +
          </button>
        </div>
      </div>
      <div className="sidebar-tree">
        <DatabaseTree onNewConnection={() => setShowConnectionModal(true)} />
      </div>
      {showConnectionModal && (
        <ConnectionManager
          onClose={() => setShowConnectionModal(false)}
        />
      )}
    </>
  );
}
