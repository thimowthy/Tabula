import { useActiveSheet, useWorkbookStore } from '../../store/useWorkbookStore';
import { useDisplayRows } from '../../store/useDisplayRows';
import { normalizeRange } from '../../grid/selection';
import type { CellStyle, NumberFormatKind } from '../../model/types';

/** Shared logic behind the formatting toolbar controls: figuring out which
 * cells the current selection covers, applying a style/number-format to all
 * of them, and reading back the "current" style from the first selected cell
 * (for button active-states). Split out of the old FormattingMenu dropdown so
 * both the inline toolbar buttons and the number-format popover can reuse it. */
export function useSelectionStyle() {
  const sheet = useActiveSheet();
  const displayRows = useDisplayRows(sheet);
  const selection = useWorkbookStore((s) => s.selection);
  const dispatch = useWorkbookStore((s) => s.dispatch);

  const rect = selection ? normalizeRange(selection) : null;
  const visibleColumns = sheet.columns.filter((c) => c.visible);
  const disabled = !rect;

  function targets(): { rowId: string; columnId: string }[] {
    if (!rect) return [];
    const list: { rowId: string; columnId: string }[] = [];
    for (let ri = rect.rowStart; ri <= Math.min(rect.rowEnd, displayRows.length - 1); ri++) {
      const row = displayRows[ri];
      for (let ci = rect.colStart; ci <= Math.min(rect.colEnd, visibleColumns.length - 1); ci++) {
        const col = visibleColumns[ci];
        if (col) list.push({ rowId: row.id, columnId: col.id });
      }
    }
    return list;
  }

  function applyStyle(style: CellStyle) {
    const t = targets();
    if (t.length === 0) return;
    dispatch({ type: 'SET_CELLS_STYLE', payload: { sheetId: sheet.id, targets: t, style } });
  }

  function applyNumberFormat(kind: NumberFormatKind, decimals: number) {
    if (!rect) return;
    const cols = visibleColumns.slice(rect.colStart, rect.colEnd + 1);
    for (const col of cols) {
      dispatch({
        type: 'SET_COLUMN_FORMAT',
        payload: { sheetId: sheet.id, columnId: col.id, numberFormat: { kind, decimals, currencySymbol: 'R$' } },
      });
    }
  }

  const current: CellStyle = (() => {
    if (!rect) return {};
    const row = displayRows[rect.rowStart];
    const col = visibleColumns[rect.colStart];
    if (!row || !col) return {};
    return { ...col.style, ...(row.styles?.[col.id] ?? {}) };
  })();

  const currentFormat = rect
    ? (visibleColumns[rect.colStart]?.numberFormat ?? { kind: 'none' as const, decimals: 0 })
    : { kind: 'none' as const, decimals: 0 };

  return { disabled, current, currentFormat, applyStyle, applyNumberFormat };
}
