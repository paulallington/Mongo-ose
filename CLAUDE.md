# Mongo-ose

Lightweight, localhost-only MongoDB management tool. Replaces Studio3T for basic needs.

## Quick Start

```bash
npm run install:all   # Install all dependencies (root + server + client)
npm run dev           # Start both server (port 3001) and client (port 5173)
```

Open http://localhost:5173 in browser.

## Architecture

- **Server**: Express + TypeScript (`server/src/`), MongoDB Node.js driver
- **Client**: React + TypeScript + Vite (`client/src/`), Monaco editor, Zustand, dark theme
- **API proxy**: Vite dev server proxies `/api` to `http://localhost:3001`

## Key Directories

- `server/src/routes/` — API route handlers (connections, databases, documents, indexes, transfer, export, import)
- `server/src/services/connection-manager.ts` — MongoClient pool + saved connection CRUD (file-based)
- `server/data/connections.json` — Persisted connection configs (plaintext, localhost-only)
- `client/src/components/` — React components organized by feature
- `client/src/stores/app-store.ts` — Zustand store (connections, selection, clipboard)
- `client/src/api/client.ts` — API fetch wrapper

## Security

This is a localhost-only tool. No authentication. Connection strings stored in plaintext in `server/data/connections.json`. Do not expose to a network.

## Build

```bash
npm run build   # Builds client (Vite) + server (tsc)
npm start       # Runs production server serving built client
```
