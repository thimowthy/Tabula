import { describe, expect, it } from 'vitest';
import { applyCommand } from './reducer';
import { createColumn, createEmptySheet, createRow } from '../model/factory';
import type { WorkbookModel } from '../model/types';

function makeWorkbook(values: string[]): { workbook: WorkbookModel; sheetId: string; columnId: string } {
  const column = createColumn({ name: 'A', type: 'text' });
  const rows = values.map((v) => createRow({ [column.id]: v }));
  const sheet = { ...createEmptySheet('Planilha1', 0, 0), columns: [column], rows };
  return {
    workbook: { sheets: [sheet], activeSheetId: sheet.id },
    sheetId: sheet.id,
    columnId: column.id,
  };
}

describe('FIND_REPLACE', () => {
  it('replaces the same value across every consecutive row, not just alternating ones', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['foo', 'foo', 'foo', 'foo', 'foo']);
    const result = applyCommand(workbook, {
      type: 'FIND_REPLACE',
      payload: { sheetId, find: 'foo', replace: 'bar', matchCase: true },
    });
    const sheet = result.workbook.sheets[0];
    for (const row of sheet.rows) {
      expect(row.cells[columnId]).toBe('bar');
    }
  });

  it('only replaces cells in the targeted columns that actually match', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['foo', 'baz', 'foo', 'baz', 'foo']);
    const result = applyCommand(workbook, {
      type: 'FIND_REPLACE',
      payload: { sheetId, find: 'foo', replace: 'bar', matchCase: true },
    });
    const sheet = result.workbook.sheets[0];
    expect(sheet.rows.map((r) => r.cells[columnId])).toEqual(['bar', 'baz', 'bar', 'baz', 'bar']);
  });

  it('respects matchCase: false to replace case-insensitively', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['Foo', 'FOO', 'foo']);
    const result = applyCommand(workbook, {
      type: 'FIND_REPLACE',
      payload: { sheetId, find: 'foo', replace: 'bar', matchCase: false },
    });
    const sheet = result.workbook.sheets[0];
    for (const row of sheet.rows) {
      expect(row.cells[columnId]).toBe('bar');
    }
  });

  it('escapes special regex characters in the find string', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['1+1=2', '1+1=2']);
    const result = applyCommand(workbook, {
      type: 'FIND_REPLACE',
      payload: { sheetId, find: '1+1', replace: 'X', matchCase: true },
    });
    const sheet = result.workbook.sheets[0];
    for (const row of sheet.rows) {
      expect(row.cells[columnId]).toBe('X=2');
    }
  });
});
