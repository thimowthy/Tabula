import { useMemo } from 'react';
import { useWorkbookStore } from './useWorkbookStore';
import type { SheetModel } from '../model/types';

/** Rows of the sheet after applying the active per-column filters (view-only, does not mutate data). */
export function useDisplayRows(sheet: SheetModel) {
  const filters = useWorkbookStore((s) => s.filters[sheet.id]);
  return useMemo(() => {
    const entries = Object.entries(filters ?? {}).filter(([, v]) => v.trim() !== '');
    if (entries.length === 0) return sheet.rows;
    return sheet.rows.filter((row) =>
      entries.every(([colId, query]) => {
        const val = row.cells[colId];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(query.toLowerCase());
      }),
    );
  }, [sheet.rows, filters]);
}
