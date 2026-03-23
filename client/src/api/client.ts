import type { SavedConnection, DatabaseInfo, CollectionInfo, CollectionStats, IndexInfo, FieldInfo } from '../types/index.js';

export interface ServerInfo {
  version: string;
  gitVersion?: string;
  modules?: string[];
  os?: string;
  uptime?: number;
  connections?: { current: number; available: number; totalCreated: number };
  storageEngine?: string;
}

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Connection CRUD
  getConnections: () => request<SavedConnection[]>('/connections'),
  createConnection: (data: { name: string; connectionString: string; color?: string }) =>
    request<SavedConnection>('/connections', { method: 'POST', body: JSON.stringify(data) }),
  updateConnection: (id: string, data: Partial<SavedConnection>) =>
    request<SavedConnection>(`/connections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteConnection: (id: string) =>
    request<void>(`/connections/${id}`, { method: 'DELETE' }),
  testConnection: (connectionString: string) =>
    request<{ ok: boolean; serverInfo?: any; error?: string }>('/connections/test', {
      method: 'POST',
      body: JSON.stringify({ connectionString }),
    }),
  testSavedConnection: (id: string) =>
    request<{ ok: boolean; serverInfo?: any; error?: string }>(`/connections/${id}/test`, { method: 'POST' }),
  connect: (id: string) => request<void>(`/connections/${id}/connect`, { method: 'POST' }),
  disconnect: (id: string) => request<void>(`/connections/${id}/disconnect`, { method: 'POST' }),
  getConnectionStatus: (id: string) => request<{ connected: boolean }>(`/connections/${id}/status`),
  getServerInfo: (id: string) => request<ServerInfo>(`/connections/${id}/server-info`),

  // Databases & Collections
  getDatabases: (connId: string) =>
    request<{ databases: DatabaseInfo[] }>(`/databases/${connId}/databases`),
  getCollections: (connId: string, db: string) =>
    request<{ collections: CollectionInfo[] }>(`/databases/${connId}/databases/${db}/collections`),
  getCollectionStats: (connId: string, db: string, col: string) =>
    request<CollectionStats>(`/databases/${connId}/databases/${db}/collections/${col}/stats`),
  createCollection: (connId: string, db: string, name: string) =>
    request<{ ok: boolean; name: string }>(`/databases/${connId}/databases/${db}/create-collection`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  dropDatabase: (connId: string, db: string) =>
    request<{ ok: boolean }>(`/databases/${connId}/databases/${db}/drop`, { method: 'DELETE' }),
  dropCollection: (connId: string, db: string, col: string) =>
    request<{ ok: boolean }>(`/databases/${connId}/databases/${db}/collections/${col}/drop`, { method: 'DELETE' }),
  renameCollection: (connId: string, db: string, col: string, newName: string) =>
    request<{ ok: boolean }>(`/databases/${connId}/databases/${db}/collections/${col}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ newName }),
    }),

  // Documents
  findDocuments: (connId: string, db: string, col: string, query: any, signal?: AbortSignal) =>
    request<{ documents: any[]; total: number }>(`/documents/${connId}/${db}/${col}/find`, {
      method: 'POST',
      body: JSON.stringify(query),
      signal,
    }),
  countDocuments: (connId: string, db: string, col: string, filter?: any, signal?: AbortSignal) =>
    request<{ count: number }>(`/documents/${connId}/${db}/${col}/count`, {
      method: 'POST',
      body: JSON.stringify({ filter }),
      signal,
    }),
  insertDocuments: (connId: string, db: string, col: string, documents: any[]) =>
    request<{ insertedCount: number }>(`/documents/${connId}/${db}/${col}/insert`, {
      method: 'POST',
      body: JSON.stringify({ documents }),
    }),
  updateDocument: (connId: string, db: string, col: string, id: string, document: any) =>
    request<{ modified: boolean }>(`/documents/${connId}/${db}/${col}/update`, {
      method: 'PUT',
      body: JSON.stringify({ id, document }),
    }),
  deleteDocuments: (connId: string, db: string, col: string, ids: string[]) =>
    request<{ deletedCount: number }>(`/documents/${connId}/${db}/${col}/delete`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),
  scanFields: (connId: string, db: string, col: string) =>
    request<{ fields: FieldInfo[] }>(`/documents/${connId}/${db}/${col}/scan-fields`, { method: 'POST' }),
  explainQuery: (connId: string, db: string, col: string, query: any) =>
    request<{ explain: any }>(`/documents/${connId}/${db}/${col}/explain`, {
      method: 'POST',
      body: JSON.stringify(query),
    }),
  updateMany: (connId: string, db: string, col: string, filter: any, update: any) =>
    request<{ matchedCount: number; modifiedCount: number }>(`/documents/${connId}/${db}/${col}/update-many`, {
      method: 'PUT',
      body: JSON.stringify({ filter, update }),
    }),
  deleteManyByFilter: (connId: string, db: string, col: string, filter: any) =>
    request<{ deletedCount: number }>(`/documents/${connId}/${db}/${col}/delete-many`, {
      method: 'POST',
      body: JSON.stringify({ filter }),
    }),
  findAndReplace: (connId: string, db: string, col: string, field: string, findValue: any, replaceValue: any, filter?: any) =>
    request<{ matchedCount: number; modifiedCount: number }>(`/documents/${connId}/${db}/${col}/find-replace`, {
      method: 'POST',
      body: JSON.stringify({ field, findValue, replaceValue, filter }),
    }),

  // Indexes
  getIndexes: (connId: string, db: string, col: string) =>
    request<{ indexes: IndexInfo[] }>(`/indexes/${connId}/${db}/${col}/indexes`),
  createIndex: (connId: string, db: string, col: string, keys: any, options?: any) =>
    request<{ name: string }>(`/indexes/${connId}/${db}/${col}/indexes`, {
      method: 'POST',
      body: JSON.stringify({ keys, options }),
    }),
  dropIndex: (connId: string, db: string, col: string, name: string) =>
    request<void>(`/indexes/${connId}/${db}/${col}/indexes/${name}`, { method: 'DELETE' }),

  // Transfer
  copyDocuments: (data: any) =>
    request<{ copied: number }>('/transfer/copy', { method: 'POST', body: JSON.stringify(data) }),
  moveDocuments: (data: any) =>
    request<{ moved: number }>('/transfer/move', { method: 'POST', body: JSON.stringify(data) }),

  // Export
  exportCollection: async (data: any): Promise<Blob | { path: string; count: number }> => {
    const res = await fetch(`${BASE}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    const contentType = res.headers.get('Content-Type') || '';
    if (contentType.includes('application/json') && data.outputPath) {
      return res.json();
    }
    return res.blob();
  },

  // Import
  importFromFile: async (
    file: File,
    connectionId: string,
    db: string,
    collection: string,
    format: string
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('connectionId', connectionId);
    formData.append('db', db);
    formData.append('collection', collection);
    formData.append('format', format);
    const res = await fetch(`${BASE}/import`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json() as Promise<{ imported: number }>;
  },
  importFromPath: (data: any) =>
    request<{ imported: number }>('/import', { method: 'POST', body: JSON.stringify(data) }),
};
