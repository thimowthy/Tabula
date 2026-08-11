import {
  isConditionGroup,
  emptyCondition,
  CONDITION_OPERATOR_LABEL,
  conditionOperatorNeedsValue,
  type ConditionExpr,
  type ConditionOperator,
} from '../../model/condition';
import { parseCellInput } from '../../model/format';
import type { ColumnDef } from '../../model/types';

interface ConditionEditorProps {
  columns: ColumnDef[];
  value: ConditionExpr;
  onChange: (next: ConditionExpr) => void;
  /** Present only when nested inside a group — the root condition can't be removed. */
  onRemove?: () => void;
}

const selectClass = 'rounded border px-2 py-1 text-[12px]';
const selectStyle = { borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' };

function LogicToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border px-2 py-1 text-[11px] font-medium"
      style={{
        borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
        color: active ? 'var(--color-accent)' : 'var(--color-text-subtle)',
        background: active ? 'var(--color-accent-soft)' : undefined,
      }}
    >
      {children}
    </button>
  );
}

/** Recursive AND/OR condition tree builder — the same shape (Condition |
 * ConditionGroup) the engine's filter_rows and when compile against, so
 * whatever this produces is directly usable by both. A leaf can be "promoted"
 * into a group (its own "+" button), and a group can add more leaves/groups —
 * together that's enough to build any nesting depth. */
export function ConditionEditor({ columns, value, onChange, onRemove }: ConditionEditorProps) {
  if (isConditionGroup(value)) {
    return (
      <div
        className="flex flex-col gap-2 rounded border p-2"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <LogicToggleButton active={value.logic === 'and'} onClick={() => onChange({ ...value, logic: 'and' })}>
              E (todas)
            </LogicToggleButton>
            <LogicToggleButton active={value.logic === 'or'} onClick={() => onChange({ ...value, logic: 'or' })}>
              OU (qualquer)
            </LogicToggleButton>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-[11px] text-[var(--color-text-subtle)] hover:text-[var(--color-danger)]"
            >
              remover grupo
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2 border-l-2 pl-2.5" style={{ borderColor: 'var(--color-border)' }}>
          {value.conditions.map((c, i) => (
            <ConditionEditor
              key={i}
              columns={columns}
              value={c}
              onChange={(next) => {
                const conditions = value.conditions.slice();
                conditions[i] = next;
                onChange({ ...value, conditions });
              }}
              onRemove={() => {
                const conditions = value.conditions.filter((_, j) => j !== i);
                onChange(conditions.length > 0 ? { ...value, conditions } : emptyCondition(columns[0]?.id ?? ''));
              }}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="text-[11px] text-[var(--color-accent)]"
            onClick={() => onChange({ ...value, conditions: [...value.conditions, emptyCondition(columns[0]?.id ?? '')] })}
          >
            + condição
          </button>
          <button
            type="button"
            className="text-[11px] text-[var(--color-accent)]"
            onClick={() =>
              onChange({
                ...value,
                conditions: [...value.conditions, { logic: 'and', conditions: [emptyCondition(columns[0]?.id ?? '')] }],
              })
            }
          >
            + grupo
          </button>
        </div>
      </div>
    );
  }

  const needsValue = conditionOperatorNeedsValue(value.operator);
  const column = columns.find((c) => c.id === value.column);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        className={selectClass}
        style={selectStyle}
        value={value.column}
        onChange={(e) => onChange({ ...value, column: e.target.value })}
      >
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        style={selectStyle}
        value={value.operator}
        onChange={(e) => onChange({ ...value, operator: e.target.value as ConditionOperator })}
      >
        {(Object.entries(CONDITION_OPERATOR_LABEL) as [ConditionOperator, string][]).map(([op, label]) => (
          <option key={op} value={op}>
            {label}
          </option>
        ))}
      </select>
      {needsValue && (
        <input
          className={selectClass}
          style={{ ...selectStyle, width: 120 }}
          value={value.value === null || value.value === undefined ? '' : String(value.value)}
          onChange={(e) => onChange({ ...value, value: parseCellInput(e.target.value, column?.type ?? 'text') })}
        />
      )}
      <button
        type="button"
        title="Adicionar mais uma condição (E/OU)"
        className="rounded border px-1.5 text-[12px] leading-5"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-subtle)' }}
        onClick={() => onChange({ logic: 'and', conditions: [value, emptyCondition(columns[0]?.id ?? '')] })}
      >
        +
      </button>
      {onRemove && (
        <button
          type="button"
          title="Remover condição"
          className="rounded border px-1.5 text-[12px] leading-5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-subtle)' }}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}
