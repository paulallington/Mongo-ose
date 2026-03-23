import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: 3001,
  dataDir: path.resolve(__dirname, '..', 'data'),
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  defaultPageSize: 50,
  maxPageSize: 1000,
};
