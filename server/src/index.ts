import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import { connectionManager } from './services/connection-manager.js';
import { errorHandler } from './middleware/error-handler.js';

import connectionsRouter from './routes/connections.js';
import databasesRouter from './routes/databases.js';
import documentsRouter from './routes/documents.js';
import indexesRouter from './routes/indexes.js';
import transferRouter from './routes/transfer.js';
import exportRouter from './routes/export.js';
import importRouter from './routes/import.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api/connections', connectionsRouter);
app.use('/api/databases', databasesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/indexes', indexesRouter);
app.use('/api/transfer', transferRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);

// In production, serve the client static files
const clientDist = config.clientDist;
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  // Only serve index.html for non-API routes (SPA fallback)
  if (_req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      // If client dist doesn't exist yet, that's fine
      next();
    }
  });
});

// Error handler (must be after all routes)
app.use(errorHandler);

export const server = app.listen(config.port, () => {
  console.log(`Mongo-ose server running on http://localhost:${config.port}`);
});

// Graceful shutdown
export async function shutdown() {
  console.log('\nShutting down...');
  await connectionManager.destroy();
  server.close(() => {
    console.log('Server closed.');
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
