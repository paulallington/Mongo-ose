import { Router, Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { EJSON } from 'bson';
import { connectionManager } from '../services/connection-manager.js';
import { config } from '../config.js';

const router = Router();

/**
 * Convert a string ID to ObjectId if it looks like one (24 hex chars),
 * otherwise return the original string.
 */
function toObjectId(id: string): ObjectId | string {
  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    return new ObjectId(id);
  }
  return id;
}

/**
 * Parse a value that could be a JSON/EJSON string or already an object.
 */
function parseEJSON(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    if (value.trim() === '') return undefined;
    return EJSON.parse(value) as Record<string, unknown>;
  }
  if (typeof value === 'object') {
    // Re-serialize and deserialize through EJSON to handle any $oid/$date etc.
    return EJSON.deserialize(value as Record<string, unknown>) as Record<string, unknown>;
  }
  return undefined;
}

// POST /:connectionId/:db/:col/find - query documents
router.post('/:connectionId/:db/:col/find', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const filter = parseEJSON(req.body.filter) ?? {};
    const sort = (parseEJSON(req.body.sort) ?? {}) as Record<string, 1 | -1>;
    const projection = parseEJSON(req.body.projection) as Record<string, 0 | 1> | undefined;
    const skip = Math.max(0, Number(req.body.skip) || 0);
    const limit = Math.min(
      Math.max(1, Number(req.body.limit) || config.defaultPageSize),
      config.maxPageSize
    );

    const [documents, total] = await Promise.all([
      collection
        .find(filter, { projection })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    res.json({
      documents: EJSON.serialize(documents),
      total,
      page: Math.floor(skip / limit) + 1,
      pageSize: limit,
    });
  } catch (err) {
    next(err);
  }
});

// POST /:connectionId/:db/:col/count - count documents matching filter
router.post('/:connectionId/:db/:col/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const filter = parseEJSON(req.body.filter) ?? {};
    const count = await collection.countDocuments(filter);

    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// POST /:connectionId/:db/:col/insert - insert documents
router.post('/:connectionId/:db/:col/insert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const { documents } = req.body;
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({ error: 'documents array is required and must not be empty' });
      return;
    }

    // Deserialize EJSON values in each document
    const deserialized = documents.map((doc: Record<string, unknown>) =>
      EJSON.deserialize(doc) as Record<string, unknown>
    );

    if (deserialized.length === 1) {
      const result = await collection.insertOne(deserialized[0]);
      res.status(201).json({ insertedId: result.insertedId, insertedCount: 1 });
    } else {
      const result = await collection.insertMany(deserialized);
      res.status(201).json({ insertedIds: result.insertedIds, insertedCount: result.insertedCount });
    }
  } catch (err) {
    next(err);
  }
});

// PUT /:connectionId/:db/:col/update - update a single document
router.put('/:connectionId/:db/:col/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const { id, document } = req.body;
    if (!id || !document) {
      res.status(400).json({ error: 'id and document are required' });
      return;
    }

    const objectId = toObjectId(id);
    const deserialized = EJSON.deserialize(document) as Record<string, unknown>;

    // Remove _id from the replacement document to avoid immutable field error
    delete deserialized._id;

    const result = await collection.replaceOne(
      { _id: objectId as any },
      deserialized
    );

    res.json({
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /:connectionId/:db/:col/delete - delete documents
router.delete('/:connectionId/:db/:col/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required and must not be empty' });
      return;
    }

    const objectIds = ids.map((id: string) => toObjectId(id));
    const result = await collection.deleteMany({ _id: { $in: objectIds } as any });

    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
});

// POST /:connectionId/:db/:col/scan-fields - scan collection fields & types
router.post('/:connectionId/:db/:col/scan-fields', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    // Sample up to 100 documents
    const sample = await collection.find({}).limit(100).toArray();

    // Track field types: path -> { typeName -> count }
    const fieldTypes = new Map<string, Map<string, number>>();

    function detectType(value: unknown): string {
      if (value === null || value === undefined) return 'null';
      if (value instanceof ObjectId) return 'objectId';
      if (value instanceof Date) return 'date';
      if (typeof value === 'boolean') return 'boolean';
      if (typeof value === 'number') return 'number';
      if (typeof value === 'string') return 'string';
      if (Array.isArray(value)) return 'array';
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        // Check for EJSON types
        if ('$oid' in obj) return 'objectId';
        if ('$date' in obj) return 'date';
        if ('$numberLong' in obj || '$numberInt' in obj) return 'number';
        if ('$numberDouble' in obj || '$numberDecimal' in obj) return 'number';
        if ('$binary' in obj) return 'binary';
        if ('$regex' in obj) return 'regex';
        if ('$timestamp' in obj) return 'timestamp';
        return 'object';
      }
      return 'unknown';
    }

    function scanObject(obj: Record<string, unknown>, prefix: string) {
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        const type = detectType(value);

        if (!fieldTypes.has(path)) {
          fieldTypes.set(path, new Map());
        }
        const counts = fieldTypes.get(path)!;
        counts.set(type, (counts.get(type) || 0) + 1);

        // Recurse into nested objects (but not arrays or special EJSON types)
        if (type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
          const v = value as Record<string, unknown>;
          const hasSpecialKeys = Object.keys(v).some(k => k.startsWith('$'));
          if (!hasSpecialKeys) {
            scanObject(v, path);
          }
        }
      }
    }

    for (const doc of sample) {
      scanObject(doc as Record<string, unknown>, '');
    }

    // Build result: pick predominant type for each field
    const fields: { name: string; path: string; type: string }[] = [];

    for (const [path, counts] of fieldTypes.entries()) {
      let maxType = 'unknown';
      let maxCount = 0;
      for (const [type, count] of counts.entries()) {
        if (type !== 'null' && count > maxCount) {
          maxCount = count;
          maxType = type;
        }
      }
      const name = path.includes('.') ? path.split('.').pop()! : path;
      fields.push({ name, path, type: maxType });
    }

    fields.sort((a, b) => a.path.localeCompare(b.path));

    res.json({ fields });
  } catch (err) {
    next(err);
  }
});

// POST /:connectionId/:db/:col/explain - explain a query
router.post('/:connectionId/:db/:col/explain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const filter = parseEJSON(req.body.filter) ?? {};
    const sort = (parseEJSON(req.body.sort) ?? {}) as Record<string, 1 | -1>;

    const explanation = await collection
      .find(filter)
      .sort(sort)
      .explain('executionStats');

    res.json({ explain: explanation });
  } catch (err) {
    next(err);
  }
});

// PUT /:connectionId/:db/:col/update-many - update multiple documents
router.put('/:connectionId/:db/:col/update-many', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const filter = parseEJSON(req.body.filter) ?? {};
    const update = parseEJSON(req.body.update);
    if (!update) {
      res.status(400).json({ error: 'update expression is required' });
      return;
    }

    const result = await collection.updateMany(filter, update as any);
    res.json({
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
});

// POST /:connectionId/:db/:col/delete-many - delete documents matching a filter
router.post('/:connectionId/:db/:col/delete-many', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const filter = parseEJSON(req.body.filter);
    if (!filter || Object.keys(filter).length === 0) {
      res.status(400).json({ error: 'A non-empty filter is required to prevent accidental deletion of all documents' });
      return;
    }

    const result = await collection.deleteMany(filter);
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
});

// POST /:connectionId/:db/:col/find-replace - find and replace values across documents
router.post('/:connectionId/:db/:col/find-replace', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;
    const db = req.params.db as string;
    const col = req.params.col as string;
    const client = connectionManager.getClient(connectionId);
    const collection = client.db(db).collection(col);

    const { field, findValue, replaceValue, filter: extraFilter } = req.body;
    if (!field || findValue === undefined || replaceValue === undefined) {
      res.status(400).json({ error: 'field, findValue, and replaceValue are required' });
      return;
    }

    // Build match filter: field must equal findValue, optionally combined with extra filter
    const matchFilter: Record<string, unknown> = { [field]: findValue };
    if (extraFilter) {
      const parsedExtra = parseEJSON(extraFilter);
      if (parsedExtra) Object.assign(matchFilter, parsedExtra);
    }

    const result = await collection.updateMany(matchFilter, { $set: { [field]: replaceValue } });
    res.json({
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
