import type { CellValue } from './types';
import { isConditionGroup, type ConditionExpr, type ConditionOperator } from './condition';

function isEmpty(v: CellValue): boolean {
  return v === null || v === undefined || v === '';
}

/** Coerces to a number when possible, trying a plain parse first and then
 * Brazilian formatting ('.' thousands separator, ',' decimal separator — e.g.
 * "1.234,56"); falls back to the string otherwise. Without the Brazilian
 * fallback, gt/lt on text values like "10,00"/"3,00" silently compare as
 * strings ("10,00" < "3,00", since '1' < '3'), which is essentially never
 * what a numeric comparison is meant to do. */
export function numOrStr(v: CellValue): number | string {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return String(v ?? '');
  const trimmed = v.trim();
  if (trimmed === '') return v;
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  const brFormat = trimmed.replace(/\./g, '').replace(',', '.');
  if (brFormat !== '' && !Number.isNaN(Number(brFormat))) return Number(brFormat);
  return v;
}

/** Mirrors the backend's Polars filter compiler (_FILTER_EXPRS in polars_engine.py)
 * closely enough that a preview here matches what the real engine will do. */
export function evaluateFilter(cell: CellValue, operator: ConditionOperator, target: CellValue): boolean {
  switch (operator) {
    case 'is_null':
      return isEmpty(cell);
    case 'not_null':
      return !isEmpty(cell);
    case 'contains':
      return !isEmpty(cell) && String(cell).toLowerCase().includes(String(target ?? '').toLowerCase());
    case 'matches':
      if (isEmpty(cell)) return false;
      try {
        return new RegExp(String(target ?? '')).test(String(cell));
      } catch {
        return false;
      }
    case 'eq':
      return numOrStr(cell) === numOrStr(target);
    case 'neq':
      return numOrStr(cell) !== numOrStr(target);
    case 'gt':
      return numOrStr(cell) > numOrStr(target);
    case 'gte':
      return numOrStr(cell) >= numOrStr(target);
    case 'lt':
      return numOrStr(cell) < numOrStr(target);
    case 'lte':
      return numOrStr(cell) <= numOrStr(target);
    default:
      return true;
  }
}

/** Row-level, multi-column evaluator built on top of evaluateFilter — the
 * one place `filter_rows` and `when` decide "does this row match?". `getCellValue`
 * abstracts over id-keyed (live) vs name-keyed (recorded step) column lookup,
 * so this function doesn't need to know which one it's dealing with. */
export function evaluateCondition(getCellValue: (columnRef: string) => CellValue, condition: ConditionExpr): boolean {
  if (isConditionGroup(condition)) {
    if (condition.conditions.length === 0) return true;
    return condition.logic === 'and'
      ? condition.conditions.every((c) => evaluateCondition(getCellValue, c))
      : condition.conditions.some((c) => evaluateCondition(getCellValue, c));
  }
  return evaluateFilter(getCellValue(condition.column), condition.operator, condition.value);
}
