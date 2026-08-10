import type { SheetModel, WorkbookModel } from './types';

export function getSheet(workbook: WorkbookModel, sheetId: string): SheetModel {
  const sheet = workbook.sheets.find((s) => s.id === sheetId);
  if (!sheet) throw new Error(`Sheet not found: ${sheetId}`);
  return sheet;
}

export function updateSheet(
  workbook: WorkbookModel,
  sheetId: string,
  updater: (sheet: SheetModel) => SheetModel,
): WorkbookModel {
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) => (s.id === sheetId ? updater(s) : s)),
  };
}
