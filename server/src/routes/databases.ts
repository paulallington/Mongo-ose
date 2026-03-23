import { Router, Request, Response, NextFunction } from 'express';
import { connectionManager } from '../services/connection-manager.js';

const router = Router();

// GET /:connectionId/databases - list databases
router.get('/:connectionId/databases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const client = connectionManager.getClient(connectionId);
    const adminDb = client.db('admin');
    const result = await adminDb.admin().listDatabases();
    res.json({ databases: result.databases });
  } catch (err) {
    next(err);
  }
});

// GET /:connectionId/databases/:db/collections - list collections
router.get('/:connectionId/databases/:db/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const client = connectionManager.getClient(connectionId);
    const database = client.db(db);
    const collections = await database.listCollections().toArray();
    res.json({ collections });
  } catch (err) {
    next(err);
  }
});

// GET /:connectionId/databases/:db/collections/:col/stats - collection stats
router.get('/:connectionId/databases/:db/collections/:col/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const database = client.db(db);
    const collection = database.collection(col);

    const [documentCount, indexes] = await Promise.all([
      collection.estimatedDocumentCount(),
      collection.indexes(),
    ]);

    // Use collStats command for storage info
    let storageSize = 0;
    let totalIndexSize = 0;
    let avgObjSize = 0;
    try {
      const stats = await database.command({ collStats: col });
      storageSize = stats.storageSize ?? 0;
      totalIndexSize = stats.totalIndexSize ?? 0;
      avgObjSize = stats.avgObjSize ?? 0;
    } catch {
      // collStats may fail on some configurations, that's ok
    }

    res.json({
      documentCount,
      indexCount: indexes.length,
      storageSize,
      totalIndexSize,
      avgObjSize,
    });
  } catch (err) {
    next(err);
  }
});

// POST /:connectionId/databases/:db/create-collection - create a new collection
router.post('/:connectionId/databases/:db/create-collection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const client = connectionManager.getClient(connectionId);
    const database = client.db(db);
    await database.createCollection(name);
    res.status(201).json({ ok: true, name });
  } catch (err) {
    next(err);
  }
});

// DELETE /:connectionId/databases/:db/drop - drop a database
router.delete('/:connectionId/databases/:db/drop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const client = connectionManager.getClient(connectionId);
    await client.db(db).dropDatabase();
    res.json({ ok: true, dropped: db });
  } catch (err) {
    next(err);
  }
});

// DELETE /:connectionId/databases/:db/collections/:col/drop - drop a collection
router.delete('/:connectionId/databases/:db/collections/:col/drop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    await client.db(db).collection(col).drop();
    res.json({ ok: true, dropped: col });
  } catch (err) {
    next(err);
  }
});

// PUT /:connectionId/databases/:db/collections/:col/rename - rename a collection
router.put('/:connectionId/databases/:db/collections/:col/rename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const { newName } = req.body;
    if (!newName || typeof newName !== 'string') {
      res.status(400).json({ error: 'newName is required' });
      return;
    }
    const client = connectionManager.getClient(connectionId);
    await client.db(db).collection(col).rename(newName);
    res.json({ ok: true, oldName: col, newName });
  } catch (err) {
    next(err);
  }
});

export default router;
