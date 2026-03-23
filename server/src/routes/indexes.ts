import { Router, Request, Response, NextFunction } from 'express';
import { connectionManager } from '../services/connection-manager.js';

const router = Router();

// GET /:connectionId/:db/:col/indexes - list all indexes
router.get('/:connectionId/:db/:col/indexes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const indexes = await collection.indexes();
    res.json({ indexes });
  } catch (err) {
    next(err);
  }
});

// POST /:connectionId/:db/:col/indexes - create an index
router.post('/:connectionId/:db/:col/indexes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const { keys, options } = req.body;
    if (!keys || typeof keys !== 'object') {
      res.status(400).json({ error: 'keys object is required (e.g., { field: 1 })' });
      return;
    }

    const indexName = await collection.createIndex(keys, options ?? {});
    res.status(201).json({ name: indexName });
  } catch (err) {
    next(err);
  }
});

// DELETE /:connectionId/:db/:col/indexes/:name - drop an index by name
router.delete('/:connectionId/:db/:col/indexes/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const name = req.params.name as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    await collection.dropIndex(name);
    res.json({ ok: true, dropped: name });
  } catch (err) {
    next(err);
  }
});

export default router;
