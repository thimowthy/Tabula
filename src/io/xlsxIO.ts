import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import { createColumn, createRow, inferColumnType } from '../model/factory';
import type { CellValue, SheetModel, WorkbookModel } from '../model/types';
import { detectHeaderRow } from './headerDetection';

function cellToValue(v: unknown): CellValue {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  return String(v);
}

export interface ImportResult {
  workbook: WorkbookModel;
  /**
   * sheetId -> id of the row auto-detected as the header, only populated
   * when `promoteHeader` is false. Lets the caller apply the promotion
   * explicitly (e.g. via `dispatch`, so it's undoable and shows up as a real
   * workflow step) instead of it being silently baked into the import — a
   * wrong auto-detection used to discard rows above it (including the row
   * the user actually wanted as the header) before there was ever a chance
   * to correct it, which made "Definir linha de cabeçalho" look broken.
   */
  detectedHeaderRowId: Record<string, string>;
}

export async function importWorkbookFile(
  file: File,
  options: { promoteHeader?: boolean } = {},
): Promise<ImportResult> {
  const promoteHeader = options.promoteHeader ?? true;
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const detectedHeaderRowId: Record<string, string> = {};

  const sheets: SheetModel[] = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];
    const headerRowIndex = detectHeaderRow(aoa);
    const headerRow = promoteHeader ? (aoa[headerRowIndex] ?? []) : [];
    const dataRows = promoteHeader ? aoa.slice(headerRowIndex + 1) : aoa;
    const columnCount = Math.max(headerRow.length, ...dataRows.map((r) => r.length), 1);

    const values: CellValue[][] = dataRows.map((r) => Array.from({ length: columnCount }, (_, i) => cellToValue(r[i])));

    const columns = Array.from({ length: columnCount }, (_, i) => {
      const colValues = values.map((r) => r[i]);
      const rawHeader = headerRow[i];
      const name = rawHeader != null && String(rawHeader).trim() !== '' ? String(rawHeader) : `Coluna ${i + 1}`;
      return createColumn({ name, type: inferColumnType(colValues) });
    });

    const rows = values.map((r) => {
      const cells: Record<string, CellValue> = {};
      columns.forEach((col, i) => {
        cells[col.id] = r[i] ?? null;
      });
      return createRow(cells);
    });

    const sheet: SheetModel = {
      id: uuid(),
      name: sheetName,
      columns,
      rows,
      baseColumns: columns,
      baseRows: rows,
      workflowSteps: [],
    };
    if (!promoteHeader) {
      const detectedRow = rows[headerRowIndex];
      if (detectedRow) detectedHeaderRowId[sheet.id] = detectedRow.id;
    }
    return sheet;
  });

  return { workbook: { sheets, activeSheetId: sheets[0].id }, detectedHeaderRowId };
}

function sheetToAOA(sheet: SheetModel): CellValue[][] {
  const header: CellValue[] = sheet.columns.map((c) => c.name);
  const rows = sheet.rows.map((r) => sheet.columns.map((c) => r.cells[c.id] ?? null));
  return [header, ...rows];
}

export function exportWorkbookToXlsx(workbook: WorkbookModel, filename: string) {
  const wb = XLSX.utils.book_new();
  // Excel opens a workbook on its first sheet by default, so the active sheet must be
  // written first — otherwise a stray blank sheet earlier in `workbook.sheets` (e.g. the
  // initial placeholder left behind after importing into a new sheet) makes the exported
  // file look empty even though the sheet the user was viewing has data.
  const orderedSheets = [...workbook.sheets].sort((a, b) =>
    a.id === workbook.activeSheetId ? -1 : b.id === workbook.activeSheetId ? 1 : 0,
  );
  for (const sheet of orderedSheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheetToAOA(sheet));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || 'Planilha');
  }
  XLSX.writeFile(wb, filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportSheetToXlsx(sheet: SheetModel, filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetToAOA(sheet));
  XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || 'Planilha');
  XLSX.writeFile(wb, filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportSheetToCsv(sheet: SheetModel, filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(sheetToAOA(sheet));
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
