import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DataGrid,
  type CalculatedColumn,
  type CellMouseArgs,
  type CellMouseEvent,
  type Column,
  type FillEvent,
  type PositionChangeArgs,
  type RenderCellProps,
  type RowsChangeData,
} from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import './grid.css';
import { useActiveSheet, useWorkbookStore } from '../store/useWorkbookStore';
import { useDisplayRows } from '../store/useDisplayRows';
import { columnLetter } from '../model/factory';
import { formatCellValue, parseCellInput } from '../model/format';
import { isWithin, normalizeRange } from './selection';
import { buildTsv, parseTsvToEdits } from './clipboard';
import { HeaderCell } from './HeaderCell';
import { makeEditCell } from './EditCell';
import { GridContextMenu, type ContextMenuKind } from './GridContextMenu';
import { ROW_NUM_KEY, ROW_HEIGHT, HEADER_HEIGHT, type GridRow } from './types';
import type { CellAddress, CellValue } from '../model/types';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function SheetGrid() {
  const sheet = useActiveSheet();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const selection = useWorkbookStore((s) => s.selection);
  const setSelection = useWorkbookStore((s) => s.setSelection);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kind: ContextMenuKind } | null>(null);

  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'cell' | 'row' | 'column'>('cell');
  const dragAnchorRef = useRef<CellAddress | null>(null);
  const shiftHeldRef = useRef(false);
  const pendingResizeRef = useRef<{ columnId: string; width: number } | null>(null);

  const visibleColumns = useMemo(() => sheet.columns.filter((c) => c.visible), [sheet.columns]);
  const displayRows = useDisplayRows(sheet);

  const rowIndexById = useMemo(() => {
    const m = new Map<string, number>();
    displayRows.forEach((r, i) => m.set(r.id, i));
    return m;
  }, [displayRows]);

  const gridRows: GridRow[] = useMemo(
    () => displayRows.map((r) => ({ id: r.id, ...r.cells }) as GridRow),
    [displayRows],
  );

  const rect = selection ? normalizeRange(selection) : null;

  function computeSelClasses(rowIdx: number, colIdx: number): string | undefined {
    if (!rect || !isWithin(rect, rowIdx, colIdx)) return undefined;
    const classes = ['tabula-selected'];
    if (rowIdx === rect.rowStart) classes.push('tabula-edge-top');
    if (rowIdx === rect.rowEnd) classes.push('tabula-edge-bottom');
    if (colIdx === rect.colStart) classes.push('tabula-edge-left');
    if (colIdx === rect.colEnd) classes.push('tabula-edge-right');
    return classes.join(' ');
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Shift') shiftHeldRef.current = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift') shiftHeldRef.current = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    function commitResize() {
      const pending = pendingResizeRef.current;
      if (pending) {
        pendingResizeRef.current = null;
        useWorkbookStore
          .getState()
          .dispatch({ type: 'SET_COLUMN_WIDTH', payload: { sheetId: sheet.id, columnId: pending.columnId, width: Math.round(pending.width) } });
      }
    }
    window.addEventListener('mouseup', commitResize);
    return () => window.removeEventListener('mouseup', commitResize);
  }, [sheet.id]);

  function beginDrag(mode: 'cell' | 'row' | 'column', cell: CellAddress, shiftKey: boolean) {
    isDraggingRef.current = true;
    dragModeRef.current = mode;
    const lastColIdx = visibleColumns.length - 1;
    const lastRowIdx = displayRows.length - 1;
    let anchor: CellAddress;
    let focus: CellAddress;

    if (mode === 'row') {
      anchor = { rowIdx: cell.rowIdx, colIdx: 0 };
      focus = { rowIdx: cell.rowIdx, colIdx: lastColIdx };
    } else if (mode === 'column') {
      anchor = { rowIdx: 0, colIdx: cell.colIdx };
      focus = { rowIdx: lastRowIdx, colIdx: cell.colIdx };
    } else {
      anchor = cell;
      focus = cell;
    }
    dragAnchorRef.current = anchor;

    const store = useWorkbookStore.getState();
    if (shiftKey && store.selection) {
      store.setSelection({ ...store.selection, focus, fullRow: mode === 'row', fullColumn: mode === 'column' });
    } else {
      store.setSelection({ anchor, focus, fullRow: mode === 'row', fullColumn: mode === 'column' });
    }

    function onMove(e: MouseEvent) {
      const anchorPos = dragAnchorRef.current;
      if (!anchorPos) return;
      if (mode === 'row') {
        const rowEl = (e.target as HTMLElement)?.closest('[role="row"]') as HTMLElement | null;
        if (!rowEl) return;
        const ariaRow = Number(rowEl.getAttribute('aria-rowindex'));
        if (Number.isNaN(ariaRow)) return;
        const targetRowIdx = clamp(ariaRow - 2, 0, lastRowIdx);
        useWorkbookStore.getState().setSelection({
          anchor: anchorPos,
          focus: { rowIdx: targetRowIdx, colIdx: lastColIdx },
          fullRow: true,
        });
      } else if (mode === 'column') {
        const cellEl = (e.target as HTMLElement)?.closest('[role="gridcell"], [role="columnheader"]') as HTMLElement | null;
        if (!cellEl) return;
        const ariaCol = Number(cellEl.getAttribute('aria-colindex'));
        if (Number.isNaN(ariaCol)) return;
        const targetColIdx = clamp(ariaCol - 2, 0, lastColIdx);
        useWorkbookStore.getState().setSelection({
          anchor: anchorPos,
          focus: { rowIdx: lastRowIdx, colIdx: targetColIdx },
          fullColumn: true,
        });
      } else {
        const cellEl = (e.target as HTMLElement)?.closest('[role="gridcell"]') as HTMLElement | null;
        if (!cellEl) return;
        const ariaCol = Number(cellEl.getAttribute('aria-colindex'));
        const rowEl = cellEl.closest('[role="row"]') as HTMLElement | null;
        const ariaRow = rowEl ? Number(rowEl.getAttribute('aria-rowindex')) : NaN;
        if (Number.isNaN(ariaCol) || Number.isNaN(ariaRow)) return;
        const targetColIdx = clamp(ariaCol - 2, 0, lastColIdx);
        const targetRowIdx = clamp(ariaRow - 2, 0, lastRowIdx);
        useWorkbookStore.getState().setSelection({ anchor: anchorPos, focus: { rowIdx: targetRowIdx, colIdx: targetColIdx } });
      }
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 0);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleCellMouseDown(args: CellMouseArgs<GridRow>, event: CellMouseEvent) {
    if (event.button !== 0) return;
    if (args.column.key === ROW_NUM_KEY) return;
    beginDrag('cell', { rowIdx: args.rowIdx, colIdx: args.column.idx - 1 }, event.shiftKey);
  }

  function handleActivePositionChange(args: PositionChangeArgs<GridRow>) {
    if (isDraggingRef.current) return;
    if (args.row === undefined || args.column === undefined) return;
    const colIdx = args.column.idx - 1;
    if (colIdx < 0) return;
    const rowIdx = args.rowIdx;
    const store = useWorkbookStore.getState();
    if (shiftHeldRef.current && store.selection) {
      store.setSelection({ ...store.selection, focus: { rowIdx, colIdx } });
    } else {
      store.setSelection({ anchor: { rowIdx, colIdx }, focus: { rowIdx, colIdx } });
    }
  }

  function handleRowsChange(rows: GridRow[], data: RowsChangeData<GridRow>) {
    const columnId = data.column.key;
    if (columnId === ROW_NUM_KEY) return;
    const column = sheet.columns.find((c) => c.id === columnId);
    const edits = data.indexes.map((i) => {
      const raw = rows[i][columnId];
      const value: CellValue = column && typeof raw === 'string' ? parseCellInput(raw, column.type) : ((raw as CellValue) ?? null);
      return { rowId: rows[i].id, columnId, value };
    });
    if (edits.length === 1) {
      dispatch({ type: 'EDIT_CELL', payload: { sheetId: sheet.id, ...edits[0] } });
    } else if (edits.length > 1) {
      dispatch({ type: 'EDIT_CELLS_BULK', payload: { sheetId: sheet.id, edits } });
    }
  }

  function handleFill(event: FillEvent<GridRow>): GridRow {
    return { ...event.targetRow, [event.columnKey]: event.sourceRow[event.columnKey] };
  }

  function handleColumnResize(column: CalculatedColumn<GridRow>, width: number | string) {
    if (column.key === ROW_NUM_KEY || typeof width !== 'number') return;
    pendingResizeRef.current = { columnId: column.key, width };
  }

  function handleColumnsReorder(sourceKey: string, targetKey: string) {
    if (sourceKey === ROW_NUM_KEY || targetKey === ROW_NUM_KEY || sourceKey === targetKey) return;
    dispatch({ type: 'MOVE_COLUMN', payload: { sheetId: sheet.id, columnId: sourceKey, beforeColumnId: targetKey } });
  }

  function isEditingElement(el: Element | null): boolean {
    return !!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
  }

  function handleCopy(e: React.ClipboardEvent) {
    if (!selection || isEditingElement(document.activeElement)) return;
    const r = normalizeRange(selection);
    e.clipboardData.setData('text/plain', buildTsv(r, displayRows, visibleColumns));
    e.preventDefault();
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (!selection || isEditingElement(document.activeElement)) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const r = normalizeRange(selection);
    const edits = parseTsvToEdits(text, r.rowStart, r.colStart, displayRows, visibleColumns);
    if (edits.length > 0) {
      dispatch({ type: 'EDIT_CELLS_BULK', payload: { sheetId: sheet.id, edits } });
      const lines = text.replace(/\r/g, '').split('\n');
      setSelection({
        anchor: { rowIdx: r.rowStart, colIdx: r.colStart },
        focus: {
          rowIdx: clamp(r.rowStart + lines.length - 1, 0, displayRows.length - 1),
          colIdx: clamp(r.colStart + (lines[0]?.split('\t').length ?? 1) - 1, 0, visibleColumns.length - 1),
        },
      });
    }
  }

  function selectCellForContextMenu(rowIdx: number, colIdx: number) {
    const current = useWorkbookStore.getState().selection;
    if (current) {
      const r = normalizeRange(current);
      if (isWithin(r, rowIdx, colIdx)) return; // keep an existing multi-cell selection intact
    }
    setSelection({ anchor: { rowIdx, colIdx }, focus: { rowIdx, colIdx } });
  }

  function selectRowForContextMenu(rowIdx: number) {
    const current = useWorkbookStore.getState().selection;
    if (current?.fullRow) {
      const r = normalizeRange(current);
      if (rowIdx >= r.rowStart && rowIdx <= r.rowEnd) return;
    }
    const lastColIdx = visibleColumns.length - 1;
    setSelection({ anchor: { rowIdx, colIdx: 0 }, focus: { rowIdx, colIdx: lastColIdx }, fullRow: true });
  }

  function selectColumnForContextMenu(colIdx: number) {
    const current = useWorkbookStore.getState().selection;
    if (current?.fullColumn) {
      const r = normalizeRange(current);
      if (colIdx >= r.colStart && colIdx <= r.colEnd) return;
    }
    const lastRowIdx = displayRows.length - 1;
    setSelection({ anchor: { rowIdx: 0, colIdx }, focus: { rowIdx: lastRowIdx, colIdx }, fullColumn: true });
  }

  function handleCellContextMenu(args: CellMouseArgs<GridRow>, event: CellMouseEvent) {
    event.preventDefault();
    if (args.column.key === ROW_NUM_KEY) {
      selectRowForContextMenu(args.rowIdx);
      setContextMenu({ x: event.clientX, y: event.clientY, kind: 'row' });
      return;
    }
    selectCellForContextMenu(args.rowIdx, args.column.idx - 1);
    setContextMenu({ x: event.clientX, y: event.clientY, kind: 'cell' });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (isEditingElement(document.activeElement)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      const r = normalizeRange(selection);
      const edits: { rowId: string; columnId: string; value: CellValue }[] = [];
      for (let ri = r.rowStart; ri <= Math.min(r.rowEnd, displayRows.length - 1); ri++) {
        const row = displayRows[ri];
        for (let ci = r.colStart; ci <= Math.min(r.colEnd, visibleColumns.length - 1); ci++) {
          const col = visibleColumns[ci];
          if (col) edits.push({ rowId: row.id, columnId: col.id, value: null });
        }
      }
      if (edits.length > 0) {
        e.preventDefault();
        dispatch({ type: 'EDIT_CELLS_BULK', payload: { sheetId: sheet.id, edits } });
      }
    }
  }

  const columns: Column<GridRow>[] = useMemo(() => {
    const rowNumColumn: Column<GridRow> = {
      key: ROW_NUM_KEY,
      name: '',
      width: 44,
      minWidth: 44,
      maxWidth: 44,
      resizable: false,
      draggable: false,
      frozen: true,
      renderHeaderCell: () => <div className="h-full w-full" style={{ background: 'var(--color-header-bg)' }} />,
      renderCell: (props: RenderCellProps<GridRow>) => {
        const rowIdx = rowIndexById.get(props.row.id) ?? props.rowIdx;
        return (
          <div
            className="tabula-rownum-cell"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              beginDrag('row', { rowIdx, colIdx: 0 }, e.shiftKey);
            }}
          >
            {rowIdx + 1}
          </div>
        );
      },
    };

    const dataColumns: Column<GridRow>[] = visibleColumns.map((col, displayIdx) => ({
      key: col.id,
      name: col.name,
      width: col.width,
      minWidth: 50,
      resizable: true,
      draggable: true,
      frozen: col.frozen || undefined,
      editable: true,
      cellClass: (row: GridRow) => {
        const rowIdx = rowIndexById.get(row.id);
        return rowIdx === undefined ? undefined : computeSelClasses(rowIdx, displayIdx);
      },
      renderHeaderCell: () => (
        <HeaderCell
          column={col}
          letter={columnLetter(sheet.columns.findIndex((c) => c.id === col.id))}
          onRename={(name) => dispatch({ type: 'RENAME_COLUMN', payload: { sheetId: sheet.id, columnId: col.id, name } })}
          onSelectColumn={(shiftKey) => beginDrag('column', { rowIdx: 0, colIdx: displayIdx }, shiftKey)}
          onContextMenu={(e) => {
            selectColumnForContextMenu(displayIdx);
            setContextMenu({ x: e.clientX, y: e.clientY, kind: 'column' });
          }}
        />
      ),
      renderCell: (props: RenderCellProps<GridRow>) => {
        const rowIdx = rowIndexById.get(props.row.id) ?? props.rowIdx;
        const rowRecord = displayRows[rowIdx];
        const value = props.row[col.id] as CellValue;
        const style = { ...col.style, ...(rowRecord?.styles?.[col.id] ?? {}) };
        const justify =
          style.align === 'right'
            ? 'flex-end'
            : style.align === 'center'
              ? 'center'
              : col.type === 'number'
                ? 'flex-end'
                : 'flex-start';
        return (
          <div
            className="tabula-cell-content"
            style={{
              fontWeight: style.bold ? 600 : 400,
              fontStyle: style.italic ? 'italic' : 'normal',
              color: style.color,
              backgroundColor: style.backgroundColor,
              justifyContent: justify,
            }}
          >
            {formatCellValue(value, col)}
          </div>
        );
      },
      renderEditCell: makeEditCell(col),
    }));

    return [rowNumColumn, ...dataColumns];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleColumns, sheet.columns, displayRows, rowIndexById, rect, sheet.id]);

  return (
    <div className="h-full w-full" onCopy={handleCopy} onPaste={handlePaste} onKeyDown={handleKeyDown}>
      <DataGrid
        className="tabula-grid"
        columns={columns}
        rows={gridRows}
        rowKeyGetter={(row) => row.id}
        rowHeight={ROW_HEIGHT}
        headerRowHeight={HEADER_HEIGHT}
        onRowsChange={handleRowsChange}
        onFill={handleFill}
        onCellMouseDown={handleCellMouseDown}
        onCellContextMenu={handleCellContextMenu}
        onActivePositionChange={handleActivePositionChange}
        onColumnResize={handleColumnResize}
        onColumnsReorder={handleColumnsReorder}
      />
      {contextMenu && (
        <GridContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          kind={contextMenu.kind}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
