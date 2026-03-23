import { Router, Request, Response, NextFunction } from 'express';
import { EJSON } from 'bson';
import { connectionManager } from '../services/connection-manager.js';
import { ExportRequest } from '../types/index.js';
// @ts-expect-error json2csv has no type declarations
import { Parser } from 'json2csv';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

/**
 * Parse a filter value that may be an EJSON string or a plain object.
 */
function parseFilter(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    if (value.trim() === '') return {};
    return EJSON.parse(value) as Record<string, unknown>;
  }
  if (typeof value === 'object') {
    return EJSON.deserialize(value as Record<string, unknown>) as Record<string, unknown>;
  }
  return {};
}

// POST / - export collection
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectionId, db, collection, format, filter, outputPath } = req.body as ExportRequest;

    if (!connectionId || !db || !collection || !format) {
      res.status(400).json({ error: 'connectionId, db, collection, and format are required' });
      return;
    }

    if (format !== 'json' && format !== 'csv') {
      res.status(400).json({ error: 'format must be "json" or "csv"' });
      return;
    }

    const client = connectionManager.getClient(connectionId);
    const coll = client.db(db).collection(collection);
    const parsedFilter = parseFilter(filter);

    const documents = await coll.find(parsedFilter).toArray();
    const serialized = documents.map(doc => EJSON.serialize(doc)) as Record<string, unknown>[];

    if (format === 'json') {
      const jsonContent = JSON.stringify(serialized, null, 2);

      if (outputPath) {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, jsonContent, 'utf-8');
        res.json({ path: outputPath, count: documents.length });
      } else {
        const filename = `${collection}_export.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(jsonContent);
      }
    } else {
      // CSV
      let csvContent: string;
      if (serialized.length === 0) {
        csvContent = '';
      } else {
        const parser = new Parser({ flatten: true });
        csvContent = parser.parse(serialized);
      }

      if (outputPath) {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, csvContent, 'utf-8');
        res.json({ path: outputPath, count: documents.length });
      } else {
        const filename = `${collection}_export.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
      }
    }
  } catch (err) {
    next(err);
  }
});

export default router;
