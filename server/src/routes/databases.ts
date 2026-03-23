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

export default router;
