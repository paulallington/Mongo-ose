export interface SavedConnection {
  id: string;
  name: string;
  connectionString: string;
  color?: string;
  createdAt: string;
}

export interface DatabaseInfo {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
}

export interface CollectionInfo {
  name: string;
  type: string;
}

export interface CollectionStats {
  documentCount: number;
  storageSize: number;
  indexCount: number;
  avgDocSize: number;
}

export interface IndexInfo {
  name: string;
  key: Record<string, number>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  v?: number;
}

export interface QueryParams {
  filter: string;
  sort: string;
  projection: string;
  skip: number;
  limit: number;
}

export interface DocumentClipboard {
  documents: any[];
  sourceConnectionId: string;
  sourceDb: string;
  sourceCollection: string;
  operation: 'copy' | 'cut';
}

export interface TreeNode {
  type: 'connection' | 'database' | 'collection';
  id: string;
  name: string;
  connectionId: string;
  dbName?: string;
  children?: TreeNode[];
  expanded?: boolean;
  connected?: boolean;
}
