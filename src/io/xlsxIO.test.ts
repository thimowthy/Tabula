import { describe, expect, it, vi } from 'vitest';
import type * as XLSXType from 'xlsx';
import { createColumn, createEmptySheet, createRow } from '../model/factory';
import type { WorkbookModel } from '../model/types';

const writeFile = vi.fn();

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof XLSXType>();
  return { ...actual, writeFile };
});

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
