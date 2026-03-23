import { app, BrowserWindow } from 'electron';
import path from 'path';

const PORT = 3001;

app.whenReady().then(async () => {
  // Set data dir to %APPDATA%/Mongo-ose/data
  process.env.MONGOOSE_DATA = path.join(app.getPath('userData'), 'data');

  // Set client dist path — inside the packaged app
  process.env.MONGOOSE_CLIENT_DIST = path.join(app.getAppPath(), 'client', 'dist');

  // Start the Express server
  const { server, shutdown } = await import(
    path.join(app.getAppPath(), 'server-bundle', 'server.cjs')
  );

  // Wait for server to be listening
  await new Promise<void>((resolve) => {
    if (server.listening) {
      resolve();
    } else {
      server.on('listening', resolve);
    }
  });

  // Create the main window
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://localhost:${PORT}`);

  app.on('window-all-closed', async () => {
    await shutdown();
    app.quit();
  });
});
