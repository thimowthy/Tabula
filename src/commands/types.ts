import type { CellStyle, CellValue, ColumnType, FilterOperator, MathOperator, NumberFormat, SheetModel } from '../model/types';

interface CellEdit {
  rowId: string;
  columnId: string;
  value: CellValue;
}

interface StyleTarget {
  rowId: string;
  columnId: string;
}

export type AppCommand =
  | { type: 'EDIT_CELL'; payload: { sheetId: string; rowId: string; columnId: string; value: CellValue } }
  | { type: 'EDIT_CELLS_BULK'; payload: { sheetId: string; edits: CellEdit[] } }
  | { type: 'INSERT_ROWS'; payload: { sheetId: string; atIndex: number; count: number } }
  | { type: 'DELETE_ROWS'; payload: { sheetId: string; rowIds: string[] } }
  | { type: 'INSERT_COLUMN'; payload: { sheetId: string; atIndex: number; name?: string } }
  | { type: 'DELETE_COLUMNS'; payload: { sheetId: string; columnIds: string[] } }
  | { type: 'RENAME_COLUMN'; payload: { sheetId: string; columnId: string; name: string } }
  | { type: 'SET_COLUMN_TYPE'; payload: { sheetId: string; columnId: string; columnType: ColumnType } }
  | { type: 'SET_COLUMN_WIDTH'; payload: { sheetId: string; columnId: string; width: number } }
  | { type: 'SET_COLUMN_FORMAT'; payload: { sheetId: string; columnId: string; numberFormat: NumberFormat } }
  | { type: 'SET_COLUMN_STYLE'; payload: { sheetId: string; columnId: string; style: CellStyle } }
  | { type: 'MOVE_COLUMN'; payload: { sheetId: string; columnId: string; beforeColumnId: string | null } }
  | { type: 'TOGGLE_COLUMN_VISIBILITY'; payload: { sheetId: string; columnId: string } }
  | { type: 'SET_COLUMN_FROZEN'; payload: { sheetId: string; columnId: string; frozen: boolean } }
  | { type: 'SORT_ROWS'; payload: { sheetId: string; columnId: string; direction: 'ASC' | 'DESC' } }
  | { type: 'SET_CELLS_STYLE'; payload: { sheetId: string; targets: StyleTarget[]; style: CellStyle } }
  | {
      type: 'FIND_REPLACE';
      payload: { sheetId: string; find: string; replace: string; matchCase: boolean; columnIds?: string[] };
    }
  | { type: 'ADD_SHEET'; payload: { name?: string } }
  | { type: 'RENAME_SHEET'; payload: { sheetId: string; name: string } }
  | { type: 'DELETE_SHEET'; payload: { sheetId: string } }
  | { type: 'DUPLICATE_SHEET'; payload: { sheetId: string } }
  | { type: 'REORDER_SHEETS'; payload: { orderedSheetIds: string[] } }
  | { type: 'CLEAR_SHEET'; payload: { sheetId: string } }
  | { type: 'TRIM_WHITESPACE'; payload: { sheetId: string; columnIds: string[] } }
  | { type: 'FILL_NULL'; payload: { sheetId: string; columnId: string; value: CellValue } }
  | {
      type: 'APPLY_FILTER_STEP';
      payload: { sheetId: string; columnId: string; operator: FilterOperator; value: CellValue };
    }
  | { type: 'CAST_TO_INTEGER'; payload: { sheetId: string; columnId: string } }
  | { type: 'CAST_TO_FLOAT'; payload: { sheetId: string; columnId: string } }
  | { type: 'CAST_TO_DATETIME'; payload: { sheetId: string; columnId: string; format?: string | null } }
  | {
      type: 'SPLIT_COLUMN';
      payload: { sheetId: string; columnId: string; delimiter: string; newNames: string[]; keepOriginal: boolean };
    }
  | { type: 'FILL_CONSTANT'; payload: { sheetId: string; columnId: string; value: CellValue } }
  | {
      type: 'APPLY_MATH';
      payload: {
        sheetId: string;
        columnId: string;
        operator: MathOperator;
        operandType: 'constant' | 'column';
        /** A number when operandType is 'constant', a columnId when it's 'column'. */
        operand: number | string;
        outputColumnName?: string;
      };
    }
  | {
      type: 'PAD_STRING';
      payload: { sheetId: string; columnId: string; length: number; padChar: string; side: 'left' | 'right' };
    }
  | { type: 'CONCAT_COLUMNS'; payload: { sheetId: string; template: string; outputColumnName: string } }
  | {
      type: 'REPLACE_TEXT';
      payload: { sheetId: string; columnId: string; find: string; replace: string; regex: boolean; matchCase: boolean };
    }
  | {
      type: 'EXTRACT_TEXT';
      payload: { sheetId: string; columnId: string; pattern: string; group: number; outputColumnName?: string };
    }
  | { type: 'MAP_VALUES'; payload: { sheetId: string; columnId: string; mapping: Record<string, CellValue> } }
  | { type: 'ROUND_NUMBER'; payload: { sheetId: string; columnId: string; decimals: number } }
  | { type: 'DEDUPLICATE_ROWS'; payload: { sheetId: string; columnIds: string[] } }
  | {
      type: 'ADD_COLUMN_STEP';
      payload: { sheetId: string; name: string; columnType: ColumnType; defaultValue: CellValue };
    }
  | { type: 'IMPORT_SHEETS'; payload: { sheets: SheetModel[] } };

export type AppCommandType = AppCommand['type'];
