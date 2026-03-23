export interface SavedConnection {
  id: string;
  name: string;
  connectionString: string;
  color?: string;
  group?: string;
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
  avgObjSize: number;
  totalIndexSize?: number;
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

/* ---- Visual Query Builder types ---- */

export interface FieldInfo {
  name: string;
  path: string;
  type: string;
}

export type QueryOperator =
  | 'equals' | 'not_equals'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between'
  | 'contains' | 'starts_with' | 'ends_with' | 'regex'
  | 'in' | 'not_in'
  | 'exists' | 'not_exists'
  | 'is_null' | 'is_not_null'
  | 'is_true' | 'is_false'
  | 'size_equals'
  | 'array_contains';

export interface QueryCondition {
  id: string;
  field: string;
  operator: QueryOperator;
  value: string;
  value2?: string; // for 'between' operator
  fieldType?: string;
}

export interface QueryGroup {
  id: string;
  matchMode: '$and' | '$or';
  conditions: (QueryCondition | QueryGroup)[];
}

export interface VisualProjection {
  field: string;
  include: boolean;
}

export interface VisualSort {
  field: string;
  direction: 1 | -1;
}
