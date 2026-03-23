import { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'react-contexify/ReactContexify.css';
import './styles.css';
import { AppShell } from './components/layout/AppShell.js';
import { useAppStore } from './stores/app-store.js';
import { api } from './api/client.js';

export default function App() {
  const setConnections = useAppStore((s) => s.setConnections);
  const setTreeData = useAppStore((s) => s.setTreeData);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    api
      .getConnections()
      .then((connections) => {
        setConnections(connections);
        setTreeData(
          connections.map((c) => ({
            type: 'connection' as const,
            id: c.id,
            name: c.name,
            connectionId: c.id,
            expanded: false,
            connected: false,
            children: [],
          }))
        );
      })
      .catch(() => {
        // Server may not be running yet -- that's fine
      });
  }, [setConnections, setTreeData]);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <AppShell />
      <ToastContainer
        position="bottom-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable={false}
        pauseOnHover
        theme={theme}
      />
    </>
  );
}
