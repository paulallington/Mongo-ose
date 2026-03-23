import { Router, Request, Response, NextFunction } from 'express';
import { EJSON } from 'bson';
import { connectionManager } from '../services/connection-manager.js';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const uploadDir = path.join(os.tmpdir(), 'mongo-explorer-uploads');
const upload = multer({ dest: uploadDir });

const router = Router();

// POST / - import to collection
router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectionId, db, collection, format, inputPath } = req.body;

    if (!connectionId || !db || !collection || !format) {
      res.status(400).json({ error: 'connectionId, db, collection, and format are required' });
      return;
    }

    if (format !== 'json' && format !== 'csv') {
      res.status(400).json({ error: 'format must be "json" or "csv"' });
      return;
    }

    let fileContent: string;

    if (req.file) {
      // File uploaded via multipart
      fileContent = await fs.readFile(req.file.path, 'utf-8');
      // Clean up the temp file
      await fs.unlink(req.file.path).catch(() => {});
    } else if (inputPath) {
      // Read from local file path
      fileContent = await fs.readFile(inputPath, 'utf-8');
    } else {
      res.status(400).json({ error: 'Either a file upload or inputPath is required' });
      return;
    }

    let documents: Record<string, unknown>[];

    if (format === 'json') {
      const parsed = JSON.parse(fileContent);
      const rawDocs: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
      documents = rawDocs.map(doc => EJSON.deserialize(doc) as Record<string, unknown>);
    } else {
      // CSV
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, unknown>[];
      documents = records;
    }

    if (documents.length === 0) {
      res.json({ imported: 0 });
      return;
    }

    const client = connectionManager.getClient(connectionId);
    const coll = client.db(db).collection(collection);
    const result = await coll.insertMany(documents);

    res.json({ imported: result.insertedCount });
  } catch (err) {
    next(err);
  }
});

export default router;
