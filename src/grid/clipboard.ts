import { formatCellValue, parseCellInput } from '../model/format';
import type { CellValue, ColumnDef, RowRecord } from '../model/types';
import type { Rect } from './selection';

/** Builds a TSV block (Excel/Sheets clipboard format) from a selection rect. */
export function buildTsv(rect: Rect, rows: RowRecord[], columns: ColumnDef[]): string {
  const lines: string[] = [];
  for (let ri = rect.rowStart; ri <= Math.min(rect.rowEnd, rows.length - 1); ri++) {
    const row = rows[ri];
    const cols: string[] = [];
    for (let ci = rect.colStart; ci <= Math.min(rect.colEnd, columns.length - 1); ci++) {
      const col = columns[ci];
      cols.push(col ? formatCellValue(row.cells[col.id] ?? null, col) : '');
    }
    lines.push(cols.join('\t'));
  }
  return lines.join('\n');
}

export interface CellEdit {
  rowId: string;
  columnId: string;
  value: CellValue;
}

/** Parses a pasted TSV block into cell edits starting at (startRow, startCol). */
export function parseTsvToEdits(
  text: string,
  startRow: number,
  startCol: number,
  rows: RowRecord[],
  columns: ColumnDef[],
): CellEdit[] {
  const grid = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.split('\t'));
  const edits: CellEdit[] = [];
  grid.forEach((line, i) => {
    const row = rows[startRow + i];
    if (!row) return;
    line.forEach((raw, j) => {
      const col = columns[startCol + j];
      if (!col) return;
      edits.push({ rowId: row.id, columnId: col.id, value: parseCellInput(raw, col.type) });
    });
  });
  return edits;
}
