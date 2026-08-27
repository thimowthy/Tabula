import { v4 as uuid } from 'uuid';
import type { CellValue, ColumnDef, ColumnType, RowRecord, SheetModel, WorkbookModel } from './types';
import { DEFAULT_NUMBER_FORMAT } from './types';

/** Converts a 0-based column index into an Excel-style letter (0 -> A, 25 -> Z, 26 -> AA). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function createColumn(overrides: Partial<ColumnDef> = {}): ColumnDef {
  return {
    id: overrides.id ?? uuid(),
    name: overrides.name ?? 'Coluna',
    type: overrides.type ?? 'text',
    width: overrides.width ?? 120,
    visible: overrides.visible ?? true,
    frozen: overrides.frozen ?? false,
    numberFormat: overrides.numberFormat ?? { ...DEFAULT_NUMBER_FORMAT },
    style: overrides.style ?? {},
  };
}

export function createRow(cells: Record<string, CellValue> = {}, id?: string): RowRecord {
  return { id: id ?? uuid(), cells };
}

export function createEmptySheet(name: string, columnCount = 8, rowCount = 40): SheetModel {
  const columns = Array.from({ length: columnCount }, (_, i) =>
    createColumn({ name: columnLetter(i) }),
  );
  const rows = Array.from({ length: rowCount }, () => {
    const cells: Record<string, CellValue> = {};
    for (const col of columns) cells[col.id] = null;
    return createRow(cells);
  });
  return { id: uuid(), name, columns, rows, baseColumns: columns, baseRows: rows, workflowSteps: [] };
}

export function createEmptyWorkbook(): WorkbookModel {
  const sheet = createEmptySheet('Planilha1');
  return { sheets: [sheet], activeSheetId: sheet.id };
}

export function inferColumnType(values: CellValue[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== null && v !== '');
  if (nonEmpty.length === 0) return 'text';
  if (nonEmpty.every((v) => typeof v === 'boolean' || v === 'TRUE' || v === 'FALSE')) return 'boolean';
  if (nonEmpty.every((v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))))) {
    return 'number';
  }
  if (nonEmpty.every((v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v))) {
    return 'date';
  }
  return 'text';
}
