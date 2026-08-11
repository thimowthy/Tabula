import type { CellValue, ColumnDef } from './types';

/** Mirrors the backend's Condition/ConditionGroup (engine/src/tabula_engine/definition/condition.py)
 * one-for-one — the single, reusable "does this row match?" shape shared by
 * `filter_rows` and `when`. Two layers, same type (same pattern already used
 * throughout the app, e.g. MathOperationOp.operand): the "live" condition
 * inside an AppCommand references columns by id (what the reducer applies
 * immediately); the recorded condition inside a WorkflowOperation/Step
 * references columns by name (portable, replayable). */
export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'matches'
  | 'is_null'
  | 'not_null';

export interface Condition {
  column: string;
  operator: ConditionOperator;
  value: CellValue;
}

export interface ConditionGroup {
  logic: 'and' | 'or';
  conditions: ConditionExpr[];
}

export type ConditionExpr = Condition | ConditionGroup;

export function isConditionGroup(expr: ConditionExpr): expr is ConditionGroup {
  return 'logic' in expr;
}

export const CONDITION_OPERATOR_LABEL: Record<ConditionOperator, string> = {
  eq: 'igual a',
  neq: 'diferente de',
  gt: 'maior que',
  gte: 'maior ou igual a',
  lt: 'menor que',
  lte: 'menor ou igual a',
  contains: 'contém',
  matches: 'corresponde ao padrão (regex)',
  is_null: 'está vazio',
  not_null: 'não está vazio',
};

export function conditionOperatorNeedsValue(operator: ConditionOperator): boolean {
  return operator !== 'is_null' && operator !== 'not_null';
}

export function emptyCondition(column: string): Condition {
  return { column, operator: 'eq', value: '' };
}

/** Recursively rewrites a condition's column references from id to name (for
 * recording) or name to id (for resolving against a sheet's current columns,
 * via a lookup function keyed the other way) — same id/name split as the rest
 * of the app, just walked over a tree. Shared by the reducer (recording a
 * step), the replay resolver, the `when`-branch preview, and step-editing. */
export function nameCondition(condition: ConditionExpr, columns: ColumnDef[]): ConditionExpr {
  if (isConditionGroup(condition)) {
    return { logic: condition.logic, conditions: condition.conditions.map((c) => nameCondition(c, columns)) };
  }
  const col = columns.find((c) => c.id === condition.column);
  return { ...condition, column: col?.name ?? condition.column };
}

/** The other direction of `nameCondition` — name to id, for pre-filling a
 * ConditionEditor from an already-recorded (name-keyed) condition. Lenient
 * (falls back to the name unchanged if the column no longer exists) since
 * this feeds a form default, not a replay that needs to surface an error. */
export function idCondition(condition: ConditionExpr, columns: ColumnDef[]): ConditionExpr {
  if (isConditionGroup(condition)) {
    return { logic: condition.logic, conditions: condition.conditions.map((c) => idCondition(c, columns)) };
  }
  const col = columns.find((c) => c.name === condition.column);
  return { ...condition, column: col?.id ?? condition.column };
}
