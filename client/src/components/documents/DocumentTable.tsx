import { useState, useRef, useEffect, useMemo, useCallback, type MutableRefObject } from 'react';
import { useContextMenu } from 'react-contexify';
import { toast } from 'react-toastify';
import { api } from '../../api/client.js';

const DOC_MENU_ID = 'document-context-menu';

interface DocumentTableProps {
  documents: any[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: (doc: any) => void;
  contextDocRef: MutableRefObject<any>;
  connectionId: string;
  db: string;
  collection: string;
  onRefresh: () => void;
}

// --- EJSON helpers ---

/** Decode base64 binary with subType 03/04 to a UUID string */
function binaryToUuid(base64: string): string {
  try {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    if (bytes.length !== 16) return base64;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  } catch {
    return base64;
  }
}

/** Extract a usable string ID from an EJSON-serialized _id field */
export function extractId(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (value.$oid) return value.$oid;
    if (value.$numberLong) return value.$numberLong;
    if (value.$uuid) return value.$uuid;
    if (value.$binary) {
      const subType = value.$binary.subType;
      if (subType === '03' || subType === '04') return binaryToUuid(value.$binary.base64);
      return value.$binary.base64;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/** Check if a value is an EJSON typed wrapper (like $oid, $date, etc.) */
function isEjsonType(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1) return false;
  return keys[0].startsWith('$');
}

/** Get the type label for a value (used for type icons) */
type CellType = 'objectId' | 'uuid' | 'string' | 'int' | 'long' | 'double' | 'decimal' | 'boolean' | 'date' | 'null' | 'array' | 'object' | 'binary' | 'regex' | 'timestamp';

function getCellType(value: any): CellType {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') {
    if (value.$oid) return 'objectId';
    if (value.$uuid) return 'uuid';
    if (value.$binary) {
      const st = value.$binary.subType;
      return (st === '03' || st === '04') ? 'uuid' : 'binary';
    }
    if (value.$date) return 'date';
    if (value.$numberInt) return 'int';
    if (value.$numberLong) return 'long';
    if (value.$numberDouble) return 'double';
    if (value.$numberDecimal) return 'decimal';
    if (value.$regularExpression) return 'regex';
    if (value.$timestamp) return 'timestamp';
    return 'object';
  }
  return 'string';
}

/** Short label + color for the type icon badge */
const TYPE_BADGES: Record<CellType, { label: string; color: string }> = {
  objectId:  { label: 'oid',  color: '#6a9fb5' },
  uuid:      { label: 'uuid', color: '#6a9fb5' },
  string:    { label: 'str',  color: '#b5bd68' },
  int:       { label: 'int',  color: '#de935f' },
  long:      { label: 'lng',  color: '#de935f' },
  double:    { label: 'dbl',  color: '#de935f' },
  decimal:   { label: 'dec',  color: '#de935f' },
  boolean:   { label: 'bool', color: '#cc6666' },
  date:      { label: 'date', color: '#b294bb' },
  null:      { label: 'null', color: '#969896' },
  array:     { label: '[ ]',  color: '#81a2be' },
  object:    { label: '{ }',  color: '#81a2be' },
  binary:    { label: 'bin',  color: '#969896' },
  regex:     { label: 'rgx',  color: '#b5bd68' },
  timestamp: { label: 'ts',   color: '#b294bb' },
};

function TypeBadge({ value }: { value: any }) {
  const cellType = getCellType(value);
  const badge = TYPE_BADGES[cellType];
  return (
    <span className="doc-table__type-badge" style={{ color: badge.color }} title={cellType}>
      {badge.label}
    </span>
  );
}

/** Format an EJSON typed value for display */
function formatEjsonValue(value: any): { text: string; className: string } {
  if (value.$oid) {
    return { text: value.$oid, className: 'doc-table__cell--id' };
  }
  if (value.$date) {
    const dateStr = typeof value.$date === 'string'
      ? value.$date
      : typeof value.$date === 'object' && value.$date.$numberLong
        ? new Date(parseInt(value.$date.$numberLong)).toISOString()
        : String(value.$date);
    return { text: dateStr, className: 'doc-table__cell--date' };
  }
  if (value.$numberLong) {
    return { text: value.$numberLong, className: 'doc-table__cell--number' };
  }
  if (value.$numberInt) {
    return { text: value.$numberInt, className: 'doc-table__cell--number' };
  }
  if (value.$numberDouble) {
    return { text: value.$numberDouble, className: 'doc-table__cell--number' };
  }
  if (value.$numberDecimal) {
    return { text: value.$numberDecimal, className: 'doc-table__cell--number' };
  }
  if (value.$binary) {
    const subType = value.$binary.subType;
    if (subType === '03' || subType === '04') {
      return { text: binaryToUuid(value.$binary.base64), className: 'doc-table__cell--id' };
    }
    return { text: `Binary(${subType})`, className: 'doc-table__cell--object' };
  }
  if (value.$regularExpression) {
    return { text: `/${value.$regularExpression.pattern}/${value.$regularExpression.options || ''}`, className: 'doc-table__cell--string' };
  }
  if (value.$timestamp) {
    return { text: `Timestamp(${value.$timestamp.t}, ${value.$timestamp.i})`, className: 'doc-table__cell--date' };
  }
  if (value.$uuid) {
    return { text: value.$uuid, className: 'doc-table__cell--id' };
  }
  // Unknown EJSON type
  const json = JSON.stringify(value);
  return { text: json.length > 80 ? json.slice(0, 80) + '...' : json, className: 'doc-table__cell--object' };
}

function formatCellValue(value: any): { text: string; className: string; isSubdoc: boolean; isArray: boolean } {
  if (value === null || value === undefined) {
    return { text: 'null', className: 'doc-table__cell--null', isSubdoc: false, isArray: false };
  }
  if (typeof value === 'boolean') {
    return { text: String(value), className: 'doc-table__cell--boolean', isSubdoc: false, isArray: false };
  }
  if (typeof value === 'number') {
    return { text: String(value), className: 'doc-table__cell--number', isSubdoc: false, isArray: false };
  }
  if (typeof value === 'string') {
    const display = value.length > 100 ? value.slice(0, 100) + '...' : value;
    return { text: display, className: 'doc-table__cell--string', isSubdoc: false, isArray: false };
  }
  if (Array.isArray(value)) {
    return {
      text: `Array (${value.length})`,
      className: 'doc-table__cell--object doc-table__cell--clickable',
      isSubdoc: false,
      isArray: true,
    };
  }
  if (typeof value === 'object') {
    // Check for EJSON special types first
    if (isEjsonType(value)) {
      const formatted = formatEjsonValue(value);
      return { ...formatted, isSubdoc: false, isArray: false };
    }
    // Regular subdocument
    const fieldCount = Object.keys(value).length;
    return {
      text: `{${fieldCount} field${fieldCount !== 1 ? 's' : ''}}`,
      className: 'doc-table__cell--object doc-table__cell--clickable',
      isSubdoc: true,
      isArray: false,
    };
  }
  return { text: String(value), className: '', isSubdoc: false, isArray: false };
}

function getValueType(value: any): 'string' | 'number' | 'boolean' | 'null' | 'object' {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'object';
}

interface EditingCell {
  docId: string;
  column: string;
}

interface InlineCellEditorProps {
  value: any;
  onSave: (newValue: any) => void;
  onCancel: () => void;
}

function InlineCellEditor({ value, onSave, onCancel }: InlineCellEditorProps) {
  const valueType = getValueType(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const [editValue, setEditValue] = useState<string>(() => {
    if (valueType === 'object') return JSON.stringify(value, null, 2);
    if (valueType === 'null') return '';
    return String(value);
  });
  const [boolValue, setBoolValue] = useState<boolean>(valueType === 'boolean' ? value : false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current && valueType !== 'boolean') {
        inputRef.current.select();
      }
    }
  }, [valueType]);

  const handleSave = useCallback(() => {
    try {
      if (valueType === 'boolean') {
        onSave(boolValue);
        return;
      }
      if (valueType === 'number') {
        const num = Number(editValue);
        if (isNaN(num)) {
          toast.error('Invalid number');
          return;
        }
        onSave(num);
        return;
      }
      if (valueType === 'null') {
        if (editValue.trim() === '' || editValue.trim().toLowerCase() === 'null') {
          onSave(null);
          return;
        }
        try {
          onSave(JSON.parse(editValue));
        } catch {
          onSave(editValue);
        }
        return;
      }
      if (valueType === 'object') {
        const parsed = JSON.parse(editValue);
        onSave(parsed);
        return;
      }
      // string
      onSave(editValue);
    } catch (err: any) {
      toast.error(`Invalid value: ${err.message}`);
    }
  }, [editValue, boolValue, valueType, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key === 'Enter' && valueType !== 'object') {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }
      if (e.key === 'Enter' && e.ctrlKey && valueType === 'object') {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }
      e.stopPropagation();
    },
    [handleSave, onCancel, valueType]
  );

  if (valueType === 'boolean') {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        className="doc-table__cell-input"
        value={String(boolValue)}
        onChange={(e) => setBoolValue(e.target.value === 'true')}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (valueType === 'object') {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        className="doc-table__cell-input doc-table__cell-input--textarea"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={valueType === 'number' ? 'number' : 'text'}
      className="doc-table__cell-input"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// --- Subdocument viewer ---
interface SubdocViewerProps {
  path: string[];
  data: any;
  onClose: () => void;
  onNavigate: (path: string[]) => void;
}

function SubdocViewer({ path, data, onClose, onNavigate }: SubdocViewerProps) {
  const isArray = Array.isArray(data);
  const entries = isArray
    ? data.map((item: any, i: number) => [String(i), item] as [string, any])
    : Object.entries(data);

  return (
    <div className="subdoc-viewer">
      <div className="subdoc-viewer__header">
        <div className="subdoc-viewer__breadcrumb">
          <span
            className="subdoc-viewer__breadcrumb-item subdoc-viewer__breadcrumb-item--clickable"
            onClick={onClose}
          >
            Document
          </span>
          {path.map((p, i) => (
            <span key={i}>
              <span className="subdoc-viewer__breadcrumb-sep"> &rsaquo; </span>
              <span
                className={`subdoc-viewer__breadcrumb-item ${i < path.length - 1 ? 'subdoc-viewer__breadcrumb-item--clickable' : ''}`}
                onClick={i < path.length - 1 ? () => onNavigate(path.slice(0, i + 1)) : undefined}
              >
                {p}
              </span>
            </span>
          ))}
        </div>
        <button className="subdoc-viewer__close" onClick={onClose}>&times;</button>
      </div>
      <table className="doc-table">
        <thead>
          <tr>
            <th>{isArray ? 'Index' : 'Field'}</th>
            <th>Type</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, val]: [string, any]) => {
            const { text, className, isSubdoc, isArray: isArr } = formatCellValue(val);
            const canDrillIn = isSubdoc || isArr;
            return (
              <tr key={key}>
                <td className="doc-table__cell--id">{key}</td>
                <td style={{ textAlign: 'center' }}>
                  <TypeBadge value={val} />
                </td>
                <td
                  className={className}
                  style={canDrillIn ? { cursor: 'pointer' } : undefined}
                  onClick={canDrillIn ? () => onNavigate([...path, key]) : undefined}
                  title={typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val ?? '')}
                >
                  {text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentTable({
  documents,
  selectedIds,
  onSelect,
  onSelectAll,
  onEdit,
  contextDocRef,
  connectionId,
  db,
  collection,
  onRefresh,
}: DocumentTableProps) {
  const { show } = useContextMenu({ id: DOC_MENU_ID });
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [subdocView, setSubdocView] = useState<{ docIndex: number; path: string[] } | null>(null);

  const columns = useMemo(() => {
    if (documents.length === 0) return [];
    const colSet = new Set<string>();
    colSet.add('_id');
    for (const doc of documents) {
      for (const key of Object.keys(doc)) {
        colSet.add(key);
      }
    }
    const cols = Array.from(colSet);
    const idx = cols.indexOf('_id');
    if (idx > 0) {
      cols.splice(idx, 1);
      cols.unshift('_id');
    }
    return cols;
  }, [documents]);

  const allSelected =
    documents.length > 0 && documents.every((d) => selectedIds.has(extractId(d._id)));

  const handleRowClick = useCallback(
    (doc: any, e: React.MouseEvent) => {
      if (editingCell) return;
      onSelect(extractId(doc._id), e.ctrlKey || e.metaKey || e.shiftKey);
    },
    [onSelect, editingCell]
  );

  const handleCellDoubleClick = useCallback(
    (doc: any, col: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (col === '_id') return;

      const value = doc[col];
      // For subdocuments/arrays, open subdoc viewer instead of inline edit
      if (typeof value === 'object' && value !== null && !isEjsonType(value)) {
        const docIndex = documents.indexOf(doc);
        setSubdocView({ docIndex, path: [col] });
        return;
      }

      setEditingCell({ docId: extractId(doc._id), column: col });
    },
    [documents]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, doc: any) => {
      e.preventDefault();
      contextDocRef.current = doc;
      show({ event: e });
    },
    [show, contextDocRef]
  );

  const handleInlineSave = useCallback(
    async (doc: any, column: string, newValue: any) => {
      const oldValue = doc[column];
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        setEditingCell(null);
        return;
      }

      const updatedDoc = { ...doc, [column]: newValue };
      const { _id, ...updatePayload } = updatedDoc;

      try {
        await api.updateDocument(connectionId, db, collection, extractId(doc._id), updatePayload);
        toast.success('Document updated');
        setEditingCell(null);
        onRefresh();
      } catch (err: any) {
        toast.error(`Update failed: ${err.message}`);
        setEditingCell(null);
      }
    },
    [connectionId, db, collection, onRefresh]
  );

  const handleInlineCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleSubdocNavigate = useCallback((path: string[]) => {
    setSubdocView((prev) => prev ? { ...prev, path } : null);
  }, []);

  const handleSubdocClose = useCallback(() => {
    setSubdocView(null);
  }, []);

  // Get nested value by path
  const getNestedValue = useCallback((doc: any, path: string[]): any => {
    let current = doc;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      current = Array.isArray(current) ? current[parseInt(key)] : current[key];
    }
    return current;
  }, []);

  if (documents.length === 0) {
    return (
      <div className="loading-overlay">
        <span className="text-muted">No documents found</span>
      </div>
    );
  }

  // If subdoc viewer is open, show it
  if (subdocView !== null) {
    const doc = documents[subdocView.docIndex];
    const nestedData = getNestedValue(doc, subdocView.path);
    if (nestedData !== undefined && typeof nestedData === 'object' && nestedData !== null) {
      return (
        <SubdocViewer
          path={subdocView.path}
          data={nestedData}
          onClose={handleSubdocClose}
          onNavigate={handleSubdocNavigate}
        />
      );
    }
    // If nested value is not an object, close subdoc view
    setSubdocView(null);
  }

  return (
    <div className="doc-table-container">
      <table className="doc-table">
        <thead>
          <tr>
            <th className="doc-table__checkbox">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, rowIdx) => {
            const docId = extractId(doc._id);
            const isSelected = selectedIds.has(docId);

            return (
              <tr
                key={docId || rowIdx}
                className={isSelected ? 'doc-table__row--selected' : ''}
                onClick={(e) => handleRowClick(doc, e)}
                onContextMenu={(e) => handleContextMenu(e, doc)}
              >
                <td className="doc-table__checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(docId, true)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                {columns.map((col) => {
                  const isEditing =
                    editingCell !== null &&
                    editingCell.docId === docId &&
                    editingCell.column === col;
                  const { text, className, isSubdoc, isArray: isArr } = formatCellValue(doc[col]);

                  if (isEditing) {
                    return (
                      <td
                        key={col}
                        className="doc-table__cell--editing"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InlineCellEditor
                          value={doc[col]}
                          onSave={(newVal) => handleInlineSave(doc, col, newVal)}
                          onCancel={handleInlineCancel}
                        />
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col}
                      className={col === '_id' ? 'doc-table__cell--id' : className}
                      title={typeof doc[col] === 'object' && doc[col] !== null ? JSON.stringify(doc[col], null, 2) : String(doc[col] ?? '')}
                      onDoubleClick={(e) => handleCellDoubleClick(doc, col, e)}
                      draggable
                      onDragStart={(e) => {
                        const cellType = getCellType(doc[col]);
                        const displayValue = col === '_id' ? extractId(doc._id) : text;
                        e.dataTransfer.setData('application/x-mongoose-cell', JSON.stringify({
                          field: col,
                          value: displayValue,
                          type: cellType,
                        }));
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <TypeBadge value={doc[col]} />
                      {col === '_id' ? extractId(doc._id) : text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
