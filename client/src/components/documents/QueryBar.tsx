import { useState, useCallback } from 'react';
import { VisualQueryBuilder } from './VisualQueryBuilder.js';

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

  const handleFind = useCallback(() => {
    onExecute(filter, sort, projection);
  }, [filter, sort, projection, onExecute]);

  const handleReset = useCallback(() => {
    setFilter('');
    setSort('');
    setProjection('');
    onReset();
  }, [onReset]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleFind();
    }
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
        <button className="btn btn--secondary" onClick={handleReset}>
          Reset
        </button>
      </div>

      {count !== null && (
        <div className="query-bar__count">
          {count.toLocaleString()} result{count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
