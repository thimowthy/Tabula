import type { CellValue, FilterOperator } from './types';

function isEmpty(v: CellValue): boolean {
  return v === null || v === undefined || v === '';
}

function numOrStr(v: CellValue): number | string {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return String(v ?? '');
}

/** Mirrors the backend's Polars filter compiler (_FILTER_EXPRS in polars_engine.py)
 * closely enough that a preview here matches what the real engine will do. */
export function evaluateFilter(cell: CellValue, operator: FilterOperator, target: CellValue): boolean {
  switch (operator) {
    case 'is_null':
      return isEmpty(cell);
    case 'not_null':
      return !isEmpty(cell);
    case 'contains':
      return !isEmpty(cell) && String(cell).toLowerCase().includes(String(target ?? '').toLowerCase());
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
