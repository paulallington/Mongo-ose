import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPkg = !!(process as any).pkg;

// When packaged as exe, data dir lives next to the executable (writable).
// In development, it's at server/data/.
const dataDir = isPkg
  ? path.join(path.dirname(process.execPath), 'data')
  : path.resolve(__dirname, '..', 'data');

// Ensure data dir exists with a default connections.json
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const connectionsFile = path.join(dataDir, 'connections.json');
if (!fs.existsSync(connectionsFile)) {
  fs.writeFileSync(connectionsFile, '[]');
}

// When packaged, client dist is embedded in snapshot as 'public/' next to the entry point.
const clientDist = isPkg
  ? path.join(__dirname, 'public')
  : path.resolve(__dirname, '..', '..', 'client', 'dist');

export const config = {
  port: 3001,
  dataDir,
  clientDist,
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  defaultPageSize: 50,
  maxPageSize: 1000,
};
