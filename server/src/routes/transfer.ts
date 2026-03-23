import { Router, Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { connectionManager } from '../services/connection-manager.js';
import { TransferRequest } from '../types/index.js';

const router = Router();

/**
 * Convert a string ID to ObjectId if it looks like one (24 hex chars).
 */
function toObjectId(id: string): ObjectId | string {
  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    return new ObjectId(id);
  }
  return id;
}

async function transferDocuments(body: TransferRequest, deleteSource: boolean): Promise<number> {
  const {
    sourceConnectionId,
    sourceDb,
    sourceCollection,
    documentIds,
    targetConnectionId,
    targetDb,
    targetCollection,
    generateNewIds,
  } = body;

  const sourceClient = connectionManager.getClient(sourceConnectionId);
  const targetClient = connectionManager.getClient(targetConnectionId);

  const sourceColl = sourceClient.db(sourceDb).collection(sourceCollection);
  const targetColl = targetClient.db(targetDb).collection(targetCollection);

  const objectIds = documentIds.map(id => toObjectId(id));
  const documents = await sourceColl.find({ _id: { $in: objectIds } as any }).toArray();

  if (documents.length === 0) {
    return 0;
  }

  const docsToInsert = documents.map(doc => {
    if (generateNewIds) {
      const { _id, ...rest } = doc;
      return rest;
    }
    return doc;
  });

  await targetColl.insertMany(docsToInsert);

  if (deleteSource) {
    const sourceIds = documents.map(doc => doc._id);
    await sourceColl.deleteMany({ _id: { $in: sourceIds } });
  }

  return documents.length;
}

// POST /copy - copy documents between collections
router.post('/copy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as TransferRequest;
    if (!body.sourceConnectionId || !body.targetConnectionId || !body.documentIds?.length) {
      res.status(400).json({ error: 'sourceConnectionId, targetConnectionId, and documentIds are required' });
      return;
    }
    const count = await transferDocuments(body, false);
    res.json({ copied: count });
  } catch (err) {
    next(err);
  }
});

// POST /move - move documents between collections (copy + delete from source)
router.post('/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as TransferRequest;
    if (!body.sourceConnectionId || !body.targetConnectionId || !body.documentIds?.length) {
      res.status(400).json({ error: 'sourceConnectionId, targetConnectionId, and documentIds are required' });
      return;
    }
    const count = await transferDocuments(body, true);
    res.json({ moved: count });
  } catch (err) {
    next(err);
  }
});

export default router;
