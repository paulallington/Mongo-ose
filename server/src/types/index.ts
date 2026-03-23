export interface SavedConnection {
  id: string;
  name: string;
  connectionString: string;
  color?: string;
  createdAt: string;
}

export interface QueryRequest {
  filter?: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  projection?: Record<string, 0 | 1>;
  skip?: number;
  limit?: number;
}

export interface TransferRequest {
  sourceConnectionId: string;
  sourceDb: string;
  sourceCollection: string;
  documentIds: string[];
  targetConnectionId: string;
  targetDb: string;
  targetCollection: string;
  generateNewIds: boolean;
}

export interface ExportRequest {
  connectionId: string;
  db: string;
  collection: string;
  format: 'json' | 'csv';
  filter?: Record<string, unknown>;
  outputPath?: string;
}

export interface ImportRequest {
  connectionId: string;
  db: string;
  collection: string;
  format: 'json' | 'csv';
  inputPath?: string;
}
