import { useState, useCallback, useEffect, useRef } from 'react';
import { VisualQueryBuilder } from './VisualQueryBuilder.js';
import { ExplainDialog } from './ExplainDialog.js';

interface QueryHistoryEntry {
  filter: string;
  sort: string;
  projection: string;
  timestamp: number;
}

const MAX_HISTORY = 20;

function getHistoryKey(connectionId: string, db: string, collection: string): string {
  return `mongoose-query-history:${connectionId}:${db}:${collection}`;
}

function loadHistory(connectionId: string, db: string, collection: string): QueryHistoryEntry[] {
  try {
    const data = localStorage.getItem(getHistoryKey(connectionId, db, collection));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveHistory(connectionId: string, db: string, collection: string, entries: QueryHistoryEntry[]) {
  try {
    localStorage.setItem(getHistoryKey(connectionId, db, collection), JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage full or unavailable
  }
}

interface QueryBarProps {
  onExecute: (filter: string, sort: string, projection: string) => void;
  onReset: () => void;
  count: number | null;
  loading: boolean;
  connectionId: string;
  db: string;
  collection: string;
}

export function QueryBar({ onExecute, onReset, count, loading, connectionId, db, collection }: QueryBarProps) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [projection, setProjection] = useState('');
  const [mode, setMode] = useState<'json' | 'visual'>('visual');
  const [showExplain, setShowExplain] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [historyPos, setHistoryPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const historyRef = useRef<HTMLDivElement>(null);
  const historyBtnRef = useRef<HTMLButtonElement>(null);

  // Load history when collection changes
  useEffect(() => {
    setHistory(loadHistory(connectionId, db, collection));
  }, [connectionId, db, collection]);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!showHistory) return;
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHistory]);

  const handleFind = useCallback(() => {
    onExecute(filter, sort, projection);
    // Save to history if there's a non-empty filter/sort/projection
    if (filter.trim() || sort.trim() || projection.trim()) {
      const entry: QueryHistoryEntry = {
        filter, sort, projection,
        timestamp: Date.now(),
      };
      const updated = [entry, ...history.filter(h =>
        h.filter !== filter || h.sort !== sort || h.projection !== projection
      )].slice(0, MAX_HISTORY);
      setHistory(updated);
      saveHistory(connectionId, db, collection, updated);
    }
  }, [filter, sort, projection, onExecute, history, connectionId, db, collection]);

  const handleReset = useCallback(() => {
    setFilter('');
    setSort('');
    setProjection('');
    onReset();
  }, [onReset]);

  const handleRecall = useCallback((entry: QueryHistoryEntry) => {
    setFilter(entry.filter);
    setSort(entry.sort);
    setProjection(entry.projection);
    setShowHistory(false);
    // Auto-switch to JSON mode to show the recalled query
    setMode('json');
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory(connectionId, db, collection, []);
    setShowHistory(false);
  }, [connectionId, db, collection]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleFind();
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const summarizeQuery = (entry: QueryHistoryEntry) => {
    const parts: string[] = [];
    if (entry.filter && entry.filter.trim()) parts.push(entry.filter.trim());
    if (entry.sort && entry.sort.trim()) parts.push(`sort: ${entry.sort.trim()}`);
    if (entry.projection && entry.projection.trim()) parts.push(`proj: ${entry.projection.trim()}`);
    const summary = parts.join(' | ');
    if (!summary) return '(empty query)';
    return summary.length > 120 ? summary.substring(0, 117) + '...' : summary;
  };

  return (
    <div className="query-bar" onKeyDown={handleKeyDown}>
      <div className="query-bar__mode-toggle">
        <button
          className={`query-bar__mode-btn ${mode === 'visual' ? 'query-bar__mode-btn--active' : ''}`}
          onClick={() => setMode('visual')}
        >
          Visual
        </button>
        <button
          className={`query-bar__mode-btn ${mode === 'json' ? 'query-bar__mode-btn--active' : ''}`}
          onClick={() => setMode('json')}
        >
          JSON
        </button>
      </div>

      {mode === 'json' ? (
        <div className="query-bar__json-fields">
          <div className="query-bar__field query-bar__field--filter">
            <label className="query-bar__label">Filter</label>
            <input
              className="form-input form-input--mono"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder='{ "field": "value" }'
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFind();
              }}
            />
          </div>

          <div className="query-bar__field query-bar__field--sort">
            <label className="query-bar__label">Sort</label>
            <input
              className="form-input form-input--mono"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              placeholder='{ "field": 1 }'
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFind();
              }}
            />
          </div>

          <div className="query-bar__field query-bar__field--projection">
            <label className="query-bar__label">Projection</label>
            <input
              className="form-input form-input--mono"
              value={projection}
              onChange={(e) => setProjection(e.target.value)}
              placeholder='{ "field": 1 }'
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFind();
              }}
            />
          </div>
        </div>
      ) : (
        <div className="query-bar__visual">
          <VisualQueryBuilder
            connectionId={connectionId}
            db={db}
            collection={collection}
            filter={filter}
            sort={sort}
            projection={projection}
            onFilterChange={setFilter}
            onSortChange={setSort}
            onProjectionChange={setProjection}
          />
        </div>
      )}

      <div className="query-bar__actions">
        <button className="btn btn--success" onClick={handleFind} disabled={loading}>
          {loading ? <span className="spinner spinner--sm" /> : null}
          Find
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setShowExplain(true)} title="Explain Plan">
          Explain
        </button>
        <div className="query-bar__history-wrapper" ref={historyRef}>
          <button
            ref={historyBtnRef}
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (!showHistory && historyBtnRef.current) {
                const rect = historyBtnRef.current.getBoundingClientRect();
                setHistoryPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 440) });
              }
              setShowHistory(!showHistory);
            }}
            title="Query History"
            disabled={history.length === 0}
          >
            History {history.length > 0 ? `(${history.length})` : ''}
          </button>
          {showHistory && history.length > 0 && (
            <div className="query-bar__history-dropdown" style={{ top: historyPos.top, left: historyPos.left }}>
              <div className="query-bar__history-header">
                <span>Recent Queries</span>
                <button className="btn btn--ghost btn--sm" onClick={handleClearHistory} style={{ fontSize: 11 }}>
                  Clear
                </button>
              </div>
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="query-bar__history-item"
                  onClick={() => handleRecall(entry)}
                >
                  <div className="query-bar__history-query">{summarizeQuery(entry)}</div>
                  <div className="query-bar__history-time">{formatTimestamp(entry.timestamp)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn--secondary" onClick={handleReset}>
          Reset
        </button>
      </div>

      {count !== null && (
        <div className="query-bar__count">
          {count.toLocaleString()} result{count !== 1 ? 's' : ''}
        </div>
      )}

      {showExplain && (
        <ExplainDialog
          connectionId={connectionId}
          db={db}
          collection={collection}
          filter={filter}
          sort={sort}
          onClose={() => setShowExplain(false)}
        />
      )}
    </div>
  );
}
