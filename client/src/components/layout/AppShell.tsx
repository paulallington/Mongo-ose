import { useState, useCallback, useRef, useEffect } from 'react';
import { Sidebar } from './Sidebar.js';
import { ContentArea } from './ContentArea.js';

export function AppShell() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(600, Math.max(200, e.clientX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div className="app-shell">
      <div
        ref={sidebarRef}
        className="app-shell__sidebar"
        style={{ width: sidebarWidth }}
      >
        <Sidebar />
        <div
          className={`app-shell__resize-handle ${isResizing ? 'app-shell__resize-handle--active' : ''}`}
          onMouseDown={startResize}
        />
      </div>
      <div className="app-shell__content">
        <ContentArea />
      </div>
    </div>
  );
}
