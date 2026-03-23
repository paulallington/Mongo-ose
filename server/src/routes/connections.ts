import { Router, Request, Response, NextFunction } from 'express';
import { connectionManager } from '../services/connection-manager.js';

const router = Router();

// GET / - list saved connections
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const connections = await connectionManager.getSavedConnections();
    res.json(connections);
  } catch (err) {
    next(err);
  }
});

// POST / - create a new saved connection
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, connectionString, color, group } = req.body;
    if (!name || !connectionString) {
      res.status(400).json({ error: 'name and connectionString are required' });
      return;
    }
    const conn = await connectionManager.saveConnection({ name, connectionString, color, group });
    res.status(201).json(conn);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - update a saved connection
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const updates = req.body;
    const conn = await connectionManager.updateConnection(id, updates);
    res.json(conn);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - delete a saved connection
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await connectionManager.deleteConnection(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /test - test connectivity with a connectionString in the body (before saving)
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectionString } = req.body;
    if (!connectionString) {
      res.status(400).json({ error: 'connectionString is required' });
      return;
    }
    const result = await connectionManager.testConnection(connectionString);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /:id/test - test connectivity using saved connection's connectionString
router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const conn = await connectionManager.getSavedConnection(id);
    if (!conn) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    const result = await connectionManager.testConnection(conn.connectionString);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /:id/connect - open MongoClient
router.post('/:id/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const conn = await connectionManager.getSavedConnection(id);
    if (!conn) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    await connectionManager.connect(id, conn.connectionString);
    res.json({ ok: true, connected: true });
  } catch (err) {
    next(err);
  }
});

// POST /:id/disconnect - close MongoClient
router.post('/:id/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await connectionManager.disconnect(id);
    res.json({ ok: true, connected: false });
  } catch (err) {
    next(err);
  }
});

// GET /:id/status - return connection status
router.get('/:id/status', (req: Request, res: Response) => {
  const id = req.params.id as string;
  res.json({ connected: connectionManager.isConnected(id) });
});

// GET /:id/server-info - return server info for an active connection
router.get('/:id/server-info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const client = connectionManager.getClient(id);
    const admin = client.db('admin');

    const [buildInfo, serverStatus] = await Promise.all([
      admin.command({ buildInfo: 1 }),
      admin.command({ serverStatus: 1 }).catch(() => null),
    ]);

    res.json({
      version: buildInfo.version,
      gitVersion: buildInfo.gitVersion,
      modules: buildInfo.modules ?? [],
      os: serverStatus?.host ?? null,
      uptime: serverStatus?.uptime ?? null,
      connections: serverStatus?.connections ?? null,
      storageEngine: serverStatus?.storageEngine?.name ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
