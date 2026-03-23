import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  FieldInfo,
  QueryOperator,
  QueryCondition,
  QueryGroup,
  VisualProjection,
  VisualSort,
} from '../../types/index.js';
import { api } from '../../api/client.js';

/* ============================================================
   Helper: unique ID generator
   ============================================================ */
let _idCounter = 0;
function uid(): string {
  return `vq_${Date.now()}_${++_idCounter}`;
}

/* ============================================================
   Operator metadata
   ============================================================ */
interface OperatorMeta {
  label: string;
  valueInputs: 0 | 1 | 2; // 0 = no value, 1 = single, 2 = range (between)
}

const OPERATOR_META: Record<QueryOperator, OperatorMeta> = {
  equals:        { label: 'equals',              valueInputs: 1 },
  not_equals:    { label: 'not equals',          valueInputs: 1 },
  gt:            { label: 'greater than',        valueInputs: 1 },
  gte:           { label: 'greater than or equal', valueInputs: 1 },
  lt:            { label: 'less than',           valueInputs: 1 },
  lte:           { label: 'less than or equal',  valueInputs: 1 },
  between:       { label: 'between',             valueInputs: 2 },
  contains:      { label: 'contains',            valueInputs: 1 },
  starts_with:   { label: 'starts with',         valueInputs: 1 },
  ends_with:     { label: 'ends with',           valueInputs: 1 },
  regex:         { label: 'regex',               valueInputs: 1 },
  in:            { label: 'in',                  valueInputs: 1 },
  not_in:        { label: 'not in',              valueInputs: 1 },
  exists:        { label: 'exists',              valueInputs: 0 },
  not_exists:    { label: 'not exists',          valueInputs: 0 },
  is_null:       { label: 'is null',             valueInputs: 0 },
  is_not_null:   { label: 'is not null',         valueInputs: 0 },
  is_true:       { label: 'is true',             valueInputs: 0 },
  is_false:      { label: 'is false',            valueInputs: 0 },
  size_equals:   { label: 'size equals',         valueInputs: 1 },
  array_contains:{ label: 'contains',            valueInputs: 1 },
};

const OPERATORS_BY_TYPE: Record<string, QueryOperator[]> = {
  string:   ['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'regex', 'in', 'not_in', 'exists', 'not_exists'],
  number:   ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'exists', 'not_exists'],
  boolean:  ['is_true', 'is_false', 'exists', 'not_exists'],
  date:     ['equals', 'gt', 'lt', 'between', 'exists', 'not_exists'],
  objectId: ['equals', 'not_equals', 'exists', 'not_exists'],
  array:    ['array_contains', 'size_equals', 'exists', 'not_exists'],
  object:   ['exists', 'not_exists'],
  unknown:  ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'between', 'contains', 'starts_with', 'ends_with', 'regex', 'in', 'not_in', 'exists', 'not_exists', 'is_null', 'is_not_null'],
};

function getOperatorsForType(type: string): QueryOperator[] {
  return OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE.unknown;
}

/* ============================================================
   Convert visual model -> MongoDB JSON
   ============================================================ */
function conditionToMongo(c: QueryCondition): Record<string, unknown> {
  const field = c.field || '_id';

  function parseVal(v: string): unknown {
    if (c.fieldType === 'number') {
      const n = Number(v);
      return isNaN(n) ? v : n;
    }
    if (c.fieldType === 'date') return { $date: v };
    if (c.fieldType === 'objectId') return { $oid: v };
    return v;
  }

  switch (c.operator) {
    case 'equals':        return { [field]: parseVal(c.value) };
    case 'not_equals':    return { [field]: { $ne: parseVal(c.value) } };
    case 'gt':            return { [field]: { $gt: parseVal(c.value) } };
    case 'gte':           return { [field]: { $gte: parseVal(c.value) } };
    case 'lt':            return { [field]: { $lt: parseVal(c.value) } };
    case 'lte':           return { [field]: { $lte: parseVal(c.value) } };
    case 'between':       return { [field]: { $gte: parseVal(c.value), $lte: parseVal(c.value2 || '') } };
    case 'contains':      return { [field]: { $regex: c.value, $options: 'i' } };
    case 'starts_with':   return { [field]: { $regex: `^${escapeRegex(c.value)}`, $options: 'i' } };
    case 'ends_with':     return { [field]: { $regex: `${escapeRegex(c.value)}$`, $options: 'i' } };
    case 'regex':         return { [field]: { $regex: c.value } };
    case 'in':            return { [field]: { $in: parseCommaSep(c.value, c.fieldType) } };
    case 'not_in':        return { [field]: { $nin: parseCommaSep(c.value, c.fieldType) } };
    case 'exists':        return { [field]: { $exists: true } };
    case 'not_exists':    return { [field]: { $exists: false } };
    case 'is_null':       return { [field]: null };
    case 'is_not_null':   return { [field]: { $ne: null } };
    case 'is_true':       return { [field]: true };
    case 'is_false':      return { [field]: false };
    case 'size_equals':   return { [field]: { $size: Number(c.value) || 0 } };
    case 'array_contains':return { [field]: parseVal(c.value) };
    default:              return { [field]: parseVal(c.value) };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCommaSep(v: string, type?: string): unknown[] {
  return v.split(',').map(s => {
    const trimmed = s.trim();
    if (type === 'number') {
      const n = Number(trimmed);
      return isNaN(n) ? trimmed : n;
    }
    return trimmed;
  });
}

function isQueryGroup(item: QueryCondition | QueryGroup): item is QueryGroup {
  return 'matchMode' in item && 'conditions' in item;
}

function groupToMongo(g: QueryGroup): Record<string, unknown> {
  const parts = g.conditions
    .filter(c => isQueryGroup(c) || (c as QueryCondition).field)
    .map(c => isQueryGroup(c) ? groupToMongo(c) : conditionToMongo(c as QueryCondition));

  if (parts.length === 0) return {};
  if (parts.length === 1 && g.matchMode === '$and') return parts[0];
  return { [g.matchMode]: parts };
}

export function visualToFilterJson(group: QueryGroup): string {
  const mongo = groupToMongo(group);
  return Object.keys(mongo).length > 0 ? JSON.stringify(mongo, null, 2) : '';
}

export function projectionToJson(projections: VisualProjection[]): string {
  if (projections.length === 0) return '';
  const obj: Record<string, number> = {};
  for (const p of projections) {
    obj[p.field] = p.include ? 1 : 0;
  }
  return JSON.stringify(obj);
}

export function sortToJson(sorts: VisualSort[]): string {
  if (sorts.length === 0) return '';
  const obj: Record<string, number> = {};
  for (const s of sorts) {
    obj[s.field] = s.direction;
  }
  return JSON.stringify(obj);
}

/* ============================================================
   Convert MongoDB JSON -> visual model (best effort)
   ============================================================ */
function detectFieldType(fields: FieldInfo[], fieldName: string): string {
  const info = fields.find(f => f.path === fieldName);
  return info?.type || 'unknown';
}

function parseMongoCondition(field: string, value: unknown, fieldType: string): QueryCondition | null {
  const base: Omit<QueryCondition, 'operator' | 'value'> = {
    id: uid(),
    field,
    fieldType,
  };

  if (value === null) return { ...base, operator: 'is_null', value: '' };
  if (value === true) return { ...base, operator: 'is_true', value: '' };
  if (value === false) return { ...base, operator: 'is_false', value: '' };
  if (typeof value === 'string' || typeof value === 'number') {
    return { ...base, operator: 'equals', value: String(value) };
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // EJSON types as direct value
    if ('$oid' in obj) return { ...base, operator: 'equals', value: String(obj.$oid), fieldType: 'objectId' };
    if ('$date' in obj) return { ...base, operator: 'equals', value: String(obj.$date), fieldType: 'date' };

    // Operator objects
    if ('$eq' in obj) return { ...base, operator: 'equals', value: String(obj.$eq) };
    if ('$ne' in obj) {
      if (obj.$ne === null) return { ...base, operator: 'is_not_null', value: '' };
      return { ...base, operator: 'not_equals', value: String(obj.$ne) };
    }
    if ('$gt' in obj && '$lte' in obj) return { ...base, operator: 'between', value: String(obj.$gt), value2: String(obj.$lte) };
    if ('$gte' in obj && '$lte' in obj) return { ...base, operator: 'between', value: String(obj.$gte), value2: String(obj.$lte) };
    if ('$gte' in obj && '$lt' in obj) return { ...base, operator: 'between', value: String(obj.$gte), value2: String(obj.$lt) };
    if ('$gt' in obj) return { ...base, operator: 'gt', value: String(obj.$gt) };
    if ('$gte' in obj) return { ...base, operator: 'gte', value: String(obj.$gte) };
    if ('$lt' in obj) return { ...base, operator: 'lt', value: String(obj.$lt) };
    if ('$lte' in obj) return { ...base, operator: 'lte', value: String(obj.$lte) };
    if ('$in' in obj && Array.isArray(obj.$in)) return { ...base, operator: 'in', value: obj.$in.map(String).join(', ') };
    if ('$nin' in obj && Array.isArray(obj.$nin)) return { ...base, operator: 'not_in', value: obj.$nin.map(String).join(', ') };
    if ('$exists' in obj) return { ...base, operator: obj.$exists ? 'exists' : 'not_exists', value: '' };
    if ('$regex' in obj) {
      const rx = String(obj.$regex);
      if (rx.startsWith('^')) return { ...base, operator: 'starts_with', value: rx.slice(1).replace(/\\\$/g, '$') };
      if (rx.endsWith('$')) return { ...base, operator: 'ends_with', value: rx.slice(0, -1) };
      if (obj.$options === 'i') return { ...base, operator: 'contains', value: rx };
      return { ...base, operator: 'regex', value: rx };
    }
    if ('$size' in obj) return { ...base, operator: 'size_equals', value: String(obj.$size) };
  }

  return null;
}

export function jsonToVisual(
  filterJson: string,
  sortJson: string,
  projectionJson: string,
  fields: FieldInfo[]
): { group: QueryGroup; projections: VisualProjection[]; sorts: VisualSort[]; warning?: string } | null {
  let warning: string | undefined;

  // Parse filter
  let group: QueryGroup = { id: uid(), matchMode: '$and', conditions: [] };
  if (filterJson.trim()) {
    try {
      const parsed = JSON.parse(filterJson);
      const result = parseFilterObject(parsed, fields);
      if (result) {
        group = result;
      } else {
        warning = 'Could not fully parse filter into visual mode';
      }
    } catch {
      return null; // invalid JSON
    }
  }

  // Parse projection
  const projections: VisualProjection[] = [];
  if (projectionJson.trim()) {
    try {
      const parsed = JSON.parse(projectionJson);
      for (const [k, v] of Object.entries(parsed)) {
        projections.push({ field: k, include: v === 1 || v === true });
      }
    } catch {
      // ignore
    }
  }

  // Parse sort
  const sorts: VisualSort[] = [];
  if (sortJson.trim()) {
    try {
      const parsed = JSON.parse(sortJson);
      for (const [k, v] of Object.entries(parsed)) {
        sorts.push({ field: k, direction: (v === -1 ? -1 : 1) });
      }
    } catch {
      // ignore
    }
  }

  return { group, projections, sorts, warning };
}

function parseFilterObject(obj: Record<string, unknown>, fields: FieldInfo[]): QueryGroup | null {
  if (!obj || typeof obj !== 'object') return null;

  // Check for $and / $or at top level
  if ('$and' in obj && Array.isArray(obj.$and)) {
    const conditions = (obj.$and as Record<string, unknown>[])
      .map(item => parseFilterItem(item, fields))
      .filter(Boolean) as (QueryCondition | QueryGroup)[];
    return { id: uid(), matchMode: '$and', conditions };
  }
  if ('$or' in obj && Array.isArray(obj.$or)) {
    const conditions = (obj.$or as Record<string, unknown>[])
      .map(item => parseFilterItem(item, fields))
      .filter(Boolean) as (QueryCondition | QueryGroup)[];
    return { id: uid(), matchMode: '$or', conditions };
  }

  // Plain field conditions: { field1: val, field2: val }
  const conditions: (QueryCondition | QueryGroup)[] = [];
  for (const [field, value] of Object.entries(obj)) {
    if (field.startsWith('$')) continue; // skip unknown operators
    const fieldType = detectFieldType(fields, field);
    const cond = parseMongoCondition(field, value, fieldType);
    if (cond) conditions.push(cond);
  }

  return { id: uid(), matchMode: '$and', conditions };
}

function parseFilterItem(item: Record<string, unknown>, fields: FieldInfo[]): QueryCondition | QueryGroup | null {
  if ('$and' in item || '$or' in item) {
    return parseFilterObject(item, fields);
  }
  // Single field condition
  const entries = Object.entries(item);
  if (entries.length === 1) {
    const [field, value] = entries[0];
    const fieldType = detectFieldType(fields, field);
    return parseMongoCondition(field, value, fieldType);
  }
  // Multiple fields — treat as implicit $and
  const conditions: QueryCondition[] = [];
  for (const [field, value] of entries) {
    const fieldType = detectFieldType(fields, field);
    const cond = parseMongoCondition(field, value, fieldType);
    if (cond) conditions.push(cond);
  }
  if (conditions.length === 1) return conditions[0];
  return { id: uid(), matchMode: '$and', conditions };
}

/* ============================================================
   Field scanning cache
   ============================================================ */
const fieldCache = new Map<string, FieldInfo[]>();

function cacheKey(connId: string, db: string, col: string) {
  return `${connId}::${db}::${col}`;
}

/* ============================================================
   Component: ConditionRow
   ============================================================ */
function ConditionRow({
  condition,
  fields,
  onChange,
  onRemove,
}: {
  condition: QueryCondition;
  fields: FieldInfo[];
  onChange: (updated: QueryCondition) => void;
  onRemove: () => void;
}) {
  const fieldType = condition.fieldType || 'unknown';
  const operators = getOperatorsForType(fieldType);
  const meta = OPERATOR_META[condition.operator];

  const handleFieldChange = (newField: string) => {
    const info = fields.find(f => f.path === newField);
    const newType = info?.type || 'unknown';
    const newOps = getOperatorsForType(newType);
    const newOp = newOps.includes(condition.operator) ? condition.operator : newOps[0];
    onChange({ ...condition, field: newField, fieldType: newType, operator: newOp });
  };

  const valueInputType = fieldType === 'number' ? 'number' : fieldType === 'date' ? 'datetime-local' : 'text';

  return (
    <div className="vqb-condition-row">
      <div className="vqb-condition-row__field">
        <input
          list={`fields-${condition.id}`}
          className="form-input vqb-input vqb-input--field"
          value={condition.field}
          onChange={e => handleFieldChange(e.target.value)}
          placeholder="field"
        />
        <datalist id={`fields-${condition.id}`}>
          {fields.map(f => (
            <option key={f.path} value={f.path}>
              {f.path} ({f.type})
            </option>
          ))}
        </datalist>
      </div>

      <select
        className="form-select vqb-input vqb-input--operator"
        value={condition.operator}
        onChange={e => onChange({ ...condition, operator: e.target.value as QueryOperator })}
      >
        {operators.map(op => (
          <option key={op} value={op}>{OPERATOR_META[op].label}</option>
        ))}
      </select>

      {meta.valueInputs >= 1 && (
        <input
          className="form-input vqb-input vqb-input--value"
          type={valueInputType}
          value={condition.value}
          onChange={e => onChange({ ...condition, value: e.target.value })}
          placeholder={condition.operator === 'in' || condition.operator === 'not_in' ? 'val1, val2, ...' : 'value'}
        />
      )}
      {meta.valueInputs === 2 && (
        <>
          <span className="vqb-condition-row__and-label">and</span>
          <input
            className="form-input vqb-input vqb-input--value"
            type={valueInputType}
            value={condition.value2 || ''}
            onChange={e => onChange({ ...condition, value2: e.target.value })}
            placeholder="max"
          />
        </>
      )}

      <button className="btn btn--ghost btn--icon vqb-remove-btn" onClick={onRemove} title="Remove condition">
        &times;
      </button>
    </div>
  );
}

/* ============================================================
   Component: GroupBuilder (recursive)
   ============================================================ */
function GroupBuilder({
  group,
  fields,
  onChange,
  onRemove,
  depth,
}: {
  group: QueryGroup;
  fields: FieldInfo[];
  onChange: (updated: QueryGroup) => void;
  onRemove?: () => void;
  depth: number;
}) {
  const [dragOver, setDragOver] = useState(false);

  const updateItem = (index: number, updated: QueryCondition | QueryGroup) => {
    const next = [...group.conditions];
    next[index] = updated;
    onChange({ ...group, conditions: next });
  };

  const removeItem = (index: number) => {
    const next = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: next });
  };

  const addCondition = () => {
    const newCond: QueryCondition = {
      id: uid(),
      field: '',
      operator: 'equals',
      value: '',
      fieldType: 'unknown',
    };
    onChange({ ...group, conditions: [...group.conditions, newCond] });
  };

  const addGroup = () => {
    const newGroup: QueryGroup = {
      id: uid(),
      matchMode: '$and',
      conditions: [{ id: uid(), field: '', operator: 'equals', value: '', fieldType: 'unknown' }],
    };
    onChange({ ...group, conditions: [...group.conditions, newGroup] });
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-mongoose-cell')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData('application/x-mongoose-cell');
    if (!raw) return;
    try {
      const { field, value, type } = JSON.parse(raw);
      // Map cell type to field type used by operators
      const typeMap: Record<string, string> = {
        objectId: 'objectId', uuid: 'string', string: 'string',
        int: 'number', long: 'number', double: 'number', decimal: 'number',
        boolean: 'boolean', date: 'date', null: 'unknown',
        array: 'array', object: 'object', binary: 'string',
        regex: 'string', timestamp: 'date',
      };
      const fieldType = typeMap[type] || 'unknown';
      const ops = getOperatorsForType(fieldType);
      const operator = ops.includes('equals') ? 'equals' : ops[0];
      const newCond: QueryCondition = {
        id: uid(),
        field,
        operator,
        value: value ?? '',
        fieldType,
      };
      onChange({ ...group, conditions: [...group.conditions, newCond] });
    } catch {
      // Invalid drag data
    }
  };

  return (
    <div className={`vqb-group ${depth > 0 ? 'vqb-group--nested' : ''}`}>
      <div className="vqb-group__header">
        <span className="vqb-group__label">Match</span>
        <select
          className="form-select vqb-input vqb-input--match-mode"
          value={group.matchMode}
          onChange={e => onChange({ ...group, matchMode: e.target.value as '$and' | '$or' })}
        >
          <option value="$and">ALL ($and)</option>
          <option value="$or">ANY ($or)</option>
        </select>
        <span className="vqb-group__label">of the following:</span>
        {onRemove && (
          <button className="btn btn--ghost btn--icon btn--sm vqb-remove-btn" onClick={onRemove} title="Remove group">
            &times;
          </button>
        )}
      </div>
      <div className="vqb-group__body">
        {group.conditions.map((item, i) =>
          isQueryGroup(item) ? (
            <GroupBuilder
              key={item.id}
              group={item}
              fields={fields}
              onChange={updated => updateItem(i, updated)}
              onRemove={() => removeItem(i)}
              depth={depth + 1}
            />
          ) : (
            <ConditionRow
              key={item.id}
              condition={item}
              fields={fields}
              onChange={updated => updateItem(i, updated)}
              onRemove={() => removeItem(i)}
            />
          )
        )}
      </div>
      <div
        className={`vqb-group__drop-zone ${dragOver ? 'vqb-group__drop-zone--active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDoubleClick={addCondition}
      >
        + Drag a cell here or double-click to add a condition
      </div>
      <div className="vqb-group__actions">
        <button className="btn btn--secondary btn--sm" onClick={addCondition}>
          + Add condition
        </button>
        <button className="btn btn--secondary btn--sm" onClick={addGroup}>
          + Add AND/OR group
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Component: ProjectionBuilder
   ============================================================ */
function ProjectionBuilder({
  projections,
  fields,
  onChange,
}: {
  projections: VisualProjection[];
  fields: FieldInfo[];
  onChange: (updated: VisualProjection[]) => void;
}) {
  const [newField, setNewField] = useState('');
  const includeMode = projections.length > 0 ? projections[0].include : true;

  const addProjection = () => {
    if (!newField.trim()) return;
    if (projections.some(p => p.field === newField.trim())) return;
    onChange([...projections, { field: newField.trim(), include: includeMode }]);
    setNewField('');
  };

  const toggleMode = () => {
    const newMode = !includeMode;
    onChange(projections.map(p => ({ ...p, include: newMode })));
  };

  const removeProjection = (index: number) => {
    onChange(projections.filter((_, i) => i !== index));
  };

  return (
    <div className="vqb-projection">
      <div className="vqb-projection__mode">
        <button
          className={`btn btn--sm ${includeMode ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => { if (!includeMode) toggleMode(); }}
        >
          Include (1)
        </button>
        <button
          className={`btn btn--sm ${!includeMode ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => { if (includeMode) toggleMode(); }}
        >
          Exclude (0)
        </button>
      </div>
      {projections.map((p, i) => (
        <div key={p.field} className="vqb-projection__row">
          <span className="vqb-projection__field-name">{p.field}</span>
          <span className={`vqb-projection__badge ${p.include ? 'vqb-projection__badge--include' : 'vqb-projection__badge--exclude'}`}>
            {p.include ? '1' : '0'}
          </span>
          <button className="btn btn--ghost btn--icon btn--sm vqb-remove-btn" onClick={() => removeProjection(i)} title="Remove">
            &times;
          </button>
        </div>
      ))}
      <div className="vqb-projection__add">
        <input
          list="proj-fields"
          className="form-input vqb-input vqb-input--field"
          value={newField}
          onChange={e => setNewField(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addProjection(); }}
          placeholder="field name"
        />
        <datalist id="proj-fields">
          {fields.filter(f => !projections.some(p => p.field === f.path)).map(f => (
            <option key={f.path} value={f.path} />
          ))}
        </datalist>
        <button className="btn btn--secondary btn--sm" onClick={addProjection}>
          + Add field
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Component: SortBuilder
   ============================================================ */
function SortBuilder({
  sorts,
  fields,
  onChange,
}: {
  sorts: VisualSort[];
  fields: FieldInfo[];
  onChange: (updated: VisualSort[]) => void;
}) {
  const [newField, setNewField] = useState('');

  const addSort = () => {
    if (!newField.trim()) return;
    if (sorts.some(s => s.field === newField.trim())) return;
    onChange([...sorts, { field: newField.trim(), direction: 1 }]);
    setNewField('');
  };

  const removeSort = (index: number) => {
    onChange(sorts.filter((_, i) => i !== index));
  };

  const toggleDirection = (index: number) => {
    const next = [...sorts];
    next[index] = { ...next[index], direction: next[index].direction === 1 ? -1 : 1 };
    onChange(next);
  };

  const updateField = (index: number, field: string) => {
    const next = [...sorts];
    next[index] = { ...next[index], field };
    onChange(next);
  };

  return (
    <div className="vqb-sort">
      {sorts.map((s, i) => (
        <div key={`${s.field}-${i}`} className="vqb-sort__row">
          <input
            list={`sort-fields-${i}`}
            className="form-input vqb-input vqb-input--field"
            value={s.field}
            onChange={e => updateField(i, e.target.value)}
            placeholder="field"
          />
          <datalist id={`sort-fields-${i}`}>
            {fields.map(f => (
              <option key={f.path} value={f.path} />
            ))}
          </datalist>
          <button
            className={`btn btn--sm vqb-sort__dir-btn ${s.direction === 1 ? 'btn--primary' : 'btn--danger'}`}
            onClick={() => toggleDirection(i)}
            title={s.direction === 1 ? 'Ascending' : 'Descending'}
          >
            {s.direction === 1 ? 'ASC' : 'DESC'}
          </button>
          <button className="btn btn--ghost btn--icon btn--sm vqb-remove-btn" onClick={() => removeSort(i)} title="Remove">
            &times;
          </button>
        </div>
      ))}
      <div className="vqb-sort__add">
        <input
          list="sort-fields-add"
          className="form-input vqb-input vqb-input--field"
          value={newField}
          onChange={e => setNewField(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addSort(); }}
          placeholder="field name"
        />
        <datalist id="sort-fields-add">
          {fields.filter(f => !sorts.some(s => s.field === f.path)).map(f => (
            <option key={f.path} value={f.path} />
          ))}
        </datalist>
        <button className="btn btn--secondary btn--sm" onClick={addSort}>
          + Add sort field
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Section wrapper (collapsible)
   ============================================================ */
function Section({
  title,
  accentClass,
  children,
  defaultOpen = true,
}: {
  title: string;
  accentClass: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`vqb-section ${accentClass}`}>
      <button className="vqb-section__header" onClick={() => setOpen(!open)}>
        <span className="vqb-section__chevron">{open ? '\u25BC' : '\u25B6'}</span>
        <span className="vqb-section__title">{title}</span>
      </button>
      {open && <div className="vqb-section__body">{children}</div>}
    </div>
  );
}

/* ============================================================
   Main: VisualQueryBuilder
   ============================================================ */
export interface VisualQueryBuilderProps {
  connectionId: string;
  db: string;
  collection: string;
  filter: string;
  sort: string;
  projection: string;
  onFilterChange: (filter: string) => void;
  onSortChange: (sort: string) => void;
  onProjectionChange: (projection: string) => void;
}

export function VisualQueryBuilder({
  connectionId,
  db,
  collection,
  filter,
  sort,
  projection,
  onFilterChange,
  onSortChange,
  onProjectionChange,
}: VisualQueryBuilderProps) {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | undefined>();

  const [queryGroup, setQueryGroup] = useState<QueryGroup>(() => ({
    id: uid(),
    matchMode: '$and',
    conditions: [],
  }));
  const [projections, setProjections] = useState<VisualProjection[]>([]);
  const [sorts, setSorts] = useState<VisualSort[]>([]);

  // Track whether changes come from within (visual) or from outside (json)
  const internalUpdate = useRef(false);

  // Scan fields on mount / collection change
  useEffect(() => {
    const key = cacheKey(connectionId, db, collection);
    if (fieldCache.has(key)) {
      setFields(fieldCache.get(key)!);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api.scanFields(connectionId, db, collection)
      .then(result => {
        if (!cancelled) {
          fieldCache.set(key, result.fields);
          setFields(result.fields);
        }
      })
      .catch(() => {
        // Silently fail — user can still type field names manually
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [connectionId, db, collection]);

  // Parse incoming JSON into visual model when JSON props change from outside
  useEffect(() => {
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }

    const result = jsonToVisual(filter, sort, projection, fields);
    if (result) {
      setQueryGroup(result.group);
      setProjections(result.projections);
      setSorts(result.sorts);
      setWarning(result.warning);
    }
  }, [filter, sort, projection, fields]);

  // When visual model changes, emit JSON back
  const handleGroupChange = useCallback((updated: QueryGroup) => {
    setQueryGroup(updated);
    internalUpdate.current = true;
    onFilterChange(visualToFilterJson(updated));
  }, [onFilterChange]);

  const handleProjectionsChange = useCallback((updated: VisualProjection[]) => {
    setProjections(updated);
    internalUpdate.current = true;
    onProjectionChange(projectionToJson(updated));
  }, [onProjectionChange]);

  const handleSortsChange = useCallback((updated: VisualSort[]) => {
    setSorts(updated);
    internalUpdate.current = true;
    onSortChange(sortToJson(updated));
  }, [onSortChange]);

  return (
    <div className="vqb">
      {loading && (
        <div className="vqb__loading">
          <span className="spinner spinner--sm" /> Scanning fields...
        </div>
      )}
      {warning && (
        <div className="vqb__warning">
          {warning}
        </div>
      )}

      <Section title="Query (Filter)" accentClass="vqb-section--filter" defaultOpen={true}>
        <GroupBuilder
          group={queryGroup}
          fields={fields}
          onChange={handleGroupChange}
          depth={0}
        />
      </Section>

      <Section title="Projection" accentClass="vqb-section--projection" defaultOpen={projections.length > 0}>
        <ProjectionBuilder
          projections={projections}
          fields={fields}
          onChange={handleProjectionsChange}
        />
      </Section>

      <Section title="Sort" accentClass="vqb-section--sort" defaultOpen={sorts.length > 0}>
        <SortBuilder
          sorts={sorts}
          fields={fields}
          onChange={handleSortsChange}
        />
      </Section>
    </div>
  );
}
