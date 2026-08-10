import { useActiveSheet, useWorkbookStore } from '../store/useWorkbookStore';
import { useDisplayRows } from '../store/useDisplayRows';
import { normalizeRange } from './selection';
import { buildTsv, parseTsvToEdits } from './clipboard';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Everything an action bound to "the current selection" can do — insert/delete
 * row/column, clear, copy, paste. Shared by the Dados menu, the grid's
 * right-click menu, and the global keyboard shortcuts so none of them
 * duplicate this logic. */
export function useSelectionActions() {
  const sheet = useActiveSheet();
  const displayRows = useDisplayRows(sheet);
  const selection = useWorkbookStore((s) => s.selection);
  const setSelection = useWorkbookStore((s) => s.setSelection);
  const dispatch = useWorkbookStore((s) => s.dispatch);

  const visibleColumns = sheet.columns.filter((c) => c.visible);
  const rect = selection ? normalizeRange(selection) : null;
  const hasSelection = !!rect;
  /** The column the user currently has selected (single cell, a row, or a
   * column), so "apply an operation" modals can default to it instead of
   * always defaulting to the first column and making the user re-pick it. */
  const selectedColumnId = rect ? visibleColumns[rect.colStart]?.id : undefined;

  function insertRows(where: 'above' | 'below') {
    if (!rect) return;
    const refDisplayIdx = where === 'above' ? rect.rowStart : rect.rowEnd;
    const refRow = displayRows[refDisplayIdx];
    const realIndex = refRow ? sheet.rows.findIndex((r) => r.id === refRow.id) : sheet.rows.length;
    const atIndex = where === 'above' ? realIndex : realIndex + 1;
    const count = rect.rowEnd - rect.rowStart + 1;
    dispatch({ type: 'INSERT_ROWS', payload: { sheetId: sheet.id, atIndex, count } });
  }

  function deleteRows() {
    if (!rect) return;
    const rowIds = displayRows.slice(rect.rowStart, rect.rowEnd + 1).map((r) => r.id);
    if (rowIds.length > 0) dispatch({ type: 'DELETE_ROWS', payload: { sheetId: sheet.id, rowIds } });
  }

  function insertColumns(where: 'left' | 'right') {
    if (!rect) return;
    const refCol = visibleColumns[where === 'left' ? rect.colStart : rect.colEnd];
    if (!refCol) return;
    const realIndex = sheet.columns.findIndex((c) => c.id === refCol.id);
    const atIndex = where === 'left' ? realIndex : realIndex + 1;
    dispatch({ type: 'INSERT_COLUMN', payload: { sheetId: sheet.id, atIndex } });
  }

  function deleteColumns() {
    if (!rect) return;
    const columnIds = visibleColumns.slice(rect.colStart, rect.colEnd + 1).map((c) => c.id);
    if (columnIds.length > 0) dispatch({ type: 'DELETE_COLUMNS', payload: { sheetId: sheet.id, columnIds } });
  }

  /** Inserts a row if the selection is a plain cell/row selection, a column if
   * it's a full-column selection — mirrors what Ctrl+Shift+"+" does in Excel. */
  function insertForSelection() {
    if (!rect) return;
    if (selection?.fullColumn) insertColumns('left');
    else insertRows('above');
  }

  function deleteForSelection() {
    if (!rect) return;
    if (selection?.fullColumn) deleteColumns();
    else deleteRows();
  }

  function clearSelection() {
    if (!rect) return;
    const edits: { rowId: string; columnId: string; value: null }[] = [];
    for (let ri = rect.rowStart; ri <= Math.min(rect.rowEnd, displayRows.length - 1); ri++) {
      const row = displayRows[ri];
      for (let ci = rect.colStart; ci <= Math.min(rect.colEnd, visibleColumns.length - 1); ci++) {
        const col = visibleColumns[ci];
        if (col) edits.push({ rowId: row.id, columnId: col.id, value: null });
      }
    }
    if (edits.length > 0) dispatch({ type: 'EDIT_CELLS_BULK', payload: { sheetId: sheet.id, edits } });
  }

  async function copySelection() {
    if (!rect) return;
    const tsv = buildTsv(rect, displayRows, visibleColumns);
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      // Clipboard permission denied or unavailable (e.g. insecure context) — the
      // native Ctrl+C path still works since it doesn't need the async API.
    }
  }

  async function pasteSelection() {
    if (!rect) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    if (!text) return;
    const edits = parseTsvToEdits(text, rect.rowStart, rect.colStart, displayRows, visibleColumns);
    if (edits.length === 0) return;
    dispatch({ type: 'EDIT_CELLS_BULK', payload: { sheetId: sheet.id, edits } });
    const lineCount = text.replace(/\r/g, '').split('\n').length;
    const colCount = text.replace(/\r/g, '').split('\n')[0]?.split('\t').length ?? 1;
    setSelection({
      anchor: { rowIdx: rect.rowStart, colIdx: rect.colStart },
      focus: {
        rowIdx: clamp(rect.rowStart + lineCount - 1, 0, displayRows.length - 1),
        colIdx: clamp(rect.colStart + colCount - 1, 0, visibleColumns.length - 1),
      },
    });
  }

  return {
    sheet,
    displayRows,
    visibleColumns,
    selection,
    rect,
    hasSelection,
    selectedColumnId,
    insertRows,
    deleteRows,
    insertColumns,
    deleteColumns,
    insertForSelection,
    deleteForSelection,
    clearSelection,
    copySelection,
    pasteSelection,
  };
}
