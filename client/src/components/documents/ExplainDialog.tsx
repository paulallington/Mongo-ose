import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../../api/client.js';

interface ExplainDialogProps {
  connectionId: string;
  db: string;
  collection: string;
  filter: string;
  sort: string;
  onClose: () => void;
}

interface ExplainSummary {
  stage: string;
  indexUsed: string | null;
  docsExamined: number;
  docsReturned: number;
  keysExamined: number;
  executionTimeMs: number;
}

function extractSummary(explain: any): ExplainSummary | null {
  try {
    const stats = explain.executionStats;
    if (!stats) return null;

    let stage = 'UNKNOWN';
    let indexUsed: string | null = null;

    const winningPlan = explain.queryPlanner?.winningPlan;
    if (winningPlan) {
      // Walk the plan tree to find the input stage
      let current = winningPlan;
      while (current?.inputStage) {
        current = current.inputStage;
      }
      stage = current?.stage || winningPlan.stage || 'UNKNOWN';
      indexUsed = current?.indexName || null;
    }

    return {
      stage,
      indexUsed,
      docsExamined: stats.totalDocsExamined ?? 0,
      docsReturned: stats.nReturned ?? 0,
      keysExamined: stats.totalKeysExamined ?? 0,
      executionTimeMs: stats.executionTimeMillis ?? 0,
    };
  } catch {
    return null;
  }
}

export function ExplainDialog({ connectionId, db, collection, filter, sort, onClose }: ExplainDialogProps) {
  const [loading, setLoading] = useState(true);
  const [explain, setExplain] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExplain() {
      try {
        const parsedFilter = filter.trim() ? JSON.parse(filter) : {};
        const parsedSort = sort.trim() ? JSON.parse(sort) : undefined;
        const result = await api.explainQuery(connectionId, db, collection, {
          filter: parsedFilter,
          sort: parsedSort,
        });
        setExplain(result.explain);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchExplain();
  }, [connectionId, db, collection, filter, sort]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const summary = explain ? extractSummary(explain) : null;

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">Explain Plan</div>
          <button className="modal__close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal__body" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div className="loading-overlay">
              <span className="spinner" /> Analyzing query...
            </div>
          ) : error ? (
            <div style={{ padding: 16 }}>
              <div className="io-dialog__result io-dialog__result--error">{error}</div>
            </div>
          ) : (
            <>
              {summary && (
                <div className="explain-summary">
                  <div className="explain-summary__row">
                    <div className={`explain-summary__badge ${summary.stage === 'COLLSCAN' ? 'explain-summary__badge--warning' : 'explain-summary__badge--good'}`}>
                      {summary.stage}
                    </div>
                    {summary.indexUsed && (
                      <span className="explain-summary__detail">
                        Index: <strong>{summary.indexUsed}</strong>
                      </span>
                    )}
                  </div>
                  <div className="explain-summary__stats">
                    <span>Returned: <strong>{summary.docsReturned.toLocaleString()}</strong></span>
                    <span>Examined: <strong>{summary.docsExamined.toLocaleString()}</strong></span>
                    <span>Keys: <strong>{summary.keysExamined.toLocaleString()}</strong></span>
                    <span>Time: <strong>{summary.executionTimeMs}ms</strong></span>
                  </div>
                </div>
              )}
              <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={JSON.stringify(explain, null, 2)}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    wrappingIndent: 'indent',
                    automaticLayout: true,
                    padding: { top: 10 },
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
