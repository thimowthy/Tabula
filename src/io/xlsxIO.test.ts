import { describe, expect, it, vi } from 'vitest';
import type * as XLSXType from 'xlsx';
import { createColumn, createEmptySheet, createRow } from '../model/factory';
import type { WorkbookModel } from '../model/types';

const writeFile = vi.fn();

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof XLSXType>();
  return { ...actual, writeFile };
});

async function aoaToFile(aoa: unknown[][], name = 'planilha.xlsx'): Promise<File> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buffer], name);
}

describe('exportWorkbookToXlsx', () => {
  it('writes the active sheet first so it is not shadowed by a stale blank sheet', async () => {
    const { exportWorkbookToXlsx } = await import('./xlsxIO');
    const XLSX = await import('xlsx');

    const blankSheet = createEmptySheet('Planilha1');

    const col = createColumn({ name: 'Nome' });
    const dataSheet = {
      ...createEmptySheet('Importada', 0, 0),
      columns: [col],
      rows: [createRow({ [col.id]: 'Ana' }), createRow({ [col.id]: 'Bruno' })],
    };

    const workbook: WorkbookModel = {
      sheets: [blankSheet, dataSheet],
      activeSheetId: dataSheet.id,
    };

    exportWorkbookToXlsx(workbook, 'teste');

    const wb = writeFile.mock.calls[0][0];
    expect(wb.SheetNames[0]).toBe('Importada');

    const firstSheetAOA = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(firstSheetAOA).toEqual([['Nome'], ['Ana'], ['Bruno']]);
  });
});

describe('importWorkbookFile', () => {
  it('promotes the detected header row and drops the rows above it by default (unchanged legacy behavior)', async () => {
    const { importWorkbookFile } = await import('./xlsxIO');
    const file = await aoaToFile([
      ['Nome', 'Idade'],
      ['Ana', 30],
      ['Bruno', 25],
    ]);

    const { workbook, detectedHeaderRowId } = await importWorkbookFile(file);
    const sheet = workbook.sheets[0];

    expect(sheet.columns.map((c) => c.name)).toEqual(['Nome', 'Idade']);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0].cells[sheet.columns[0].id]).toBe('Ana');
    // Legacy callers never receive a detection map — the promotion already happened.
    expect(detectedHeaderRowId).toEqual({});
  });

  it('keeps every row (and generic column names) when promoteHeader is false, instead of discarding rows above the detected header', async () => {
    const { importWorkbookFile } = await import('./xlsxIO');
    // A title row above the real header is exactly the shape that can fool
    // the auto-detector into picking the wrong row (see headerDetection.ts).
    const aoa = [
      ['Relatório mensal'],
      ['Nome', 'Idade'],
      ['Ana', 30],
      ['Bruno', 25],
    ];
    const file = await aoaToFile(aoa);

    const { workbook, detectedHeaderRowId } = await importWorkbookFile(file, { promoteHeader: false });
    const sheet = workbook.sheets[0];

    // Nothing is discarded up front — every source row survives as a data row,
    // so the real header is always still selectable afterwards even if the
    // heuristic guessed a different row.
    expect(sheet.rows).toHaveLength(aoa.length);
    expect(sheet.columns.map((c) => c.name)).toEqual(['Coluna 1', 'Coluna 2']);

    const detectedRowId = detectedHeaderRowId[sheet.id];
    expect(detectedRowId).toBeDefined();
    const detectedRow = sheet.rows.find((r) => r.id === detectedRowId);
    expect(detectedRow).toBeDefined();
  });
});
