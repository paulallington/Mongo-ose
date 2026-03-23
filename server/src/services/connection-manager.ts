import { MongoClient } from 'mongodb';
import { SavedConnection } from '../types/index.js';
import { config } from '../config.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const connectionsFile = path.join(config.dataDir, 'connections.json');

class ConnectionManager {
  private clients = new Map<string, { client: MongoClient; lastUsed: Date }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupIdle(), 5 * 60 * 1000);
  }

  // --- Saved connections CRUD (file-based) ---

  async getSavedConnections(): Promise<SavedConnection[]> {
    const data = await fs.readFile(connectionsFile, 'utf-8');
    return JSON.parse(data);
  }

  async getSavedConnection(id: string): Promise<SavedConnection | undefined> {
    const connections = await this.getSavedConnections();
    return connections.find(c => c.id === id);
  }

  async saveConnection(conn: Omit<SavedConnection, 'id' | 'createdAt'>): Promise<SavedConnection> {
    const connections = await this.getSavedConnections();
    const newConn: SavedConnection = {
      ...conn,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    connections.push(newConn);
    await fs.writeFile(connectionsFile, JSON.stringify(connections, null, 2));
    return newConn;
  }

  async updateConnection(id: string, updates: Partial<SavedConnection>): Promise<SavedConnection> {
    const connections = await this.getSavedConnections();
    const index = connections.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Connection not found');
    connections[index] = { ...connections[index], ...updates, id }; // don't allow id change
    await fs.writeFile(connectionsFile, JSON.stringify(connections, null, 2));
    return connections[index];
  }

  async deleteConnection(id: string): Promise<void> {
    const connections = await this.getSavedConnections();
    const filtered = connections.filter(c => c.id !== id);
    await fs.writeFile(connectionsFile, JSON.stringify(filtered, null, 2));
    await this.disconnect(id);
  }

  // --- Active connection management ---

  async connect(id: string, connectionString: string): Promise<void> {
    if (this.clients.has(id)) return;
    const client = new MongoClient(connectionString);
    await client.connect();
    this.clients.set(id, { client, lastUsed: new Date() });
  }

  async disconnect(id: string): Promise<void> {
    const entry = this.clients.get(id);
    if (entry) {
      await entry.client.close();
      this.clients.delete(id);
    }
  }

  getClient(id: string): MongoClient {
    const entry = this.clients.get(id);
    if (!entry) throw new Error('Not connected. Connect first.');
    entry.lastUsed = new Date();
    return entry.client;
  }

  isConnected(id: string): boolean {
    return this.clients.has(id);
  }

  async testConnection(connectionString: string): Promise<{ ok: boolean; serverInfo?: { version: string }; error?: string }> {
    const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
      const admin = client.db('admin');
      const serverInfo = await admin.command({ buildInfo: 1 });
      return { ok: true, serverInfo: { version: serverInfo.version } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    } finally {
      await client.close();
    }
  }

  private cleanupIdle() {
    const now = Date.now();
    for (const [id, entry] of this.clients) {
      if (now - entry.lastUsed.getTime() > config.idleTimeoutMs) {
        entry.client.close().catch(() => {});
        this.clients.delete(id);
        console.log(`Closed idle connection: ${id}`);
      }
    }
  }

  async destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    for (const [, entry] of this.clients) {
      await entry.client.close();
    }
    this.clients.clear();
  }
}

export const connectionManager = new ConnectionManager();
