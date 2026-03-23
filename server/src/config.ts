import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In Electron, paths are set via env vars. In dev, use local paths.
const dataDir = process.env.MONGOOSE_DATA
  || path.resolve(__dirname, '..', 'data');

// Ensure data dir exists with a default connections.json
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const connectionsFile = path.join(dataDir, 'connections.json');
if (!fs.existsSync(connectionsFile)) {
  fs.writeFileSync(connectionsFile, '[]');
}

const clientDist = process.env.MONGOOSE_CLIENT_DIST
  || path.resolve(__dirname, '..', '..', 'client', 'dist');

export const config = {
  port: 3001,
  dataDir,
  clientDist,
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  defaultPageSize: 50,
  maxPageSize: 1000,
};
