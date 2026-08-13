import type { ConditionExpr } from './condition';

export type ColumnType = 'text' | 'number' | 'date' | 'boolean';

export type Alignment = 'left' | 'center' | 'right';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  backgroundColor?: string;
  align?: Alignment;
}

export type NumberFormatKind = 'none' | 'currency' | 'percent' | 'decimal';

export interface NumberFormat {
  kind: NumberFormatKind;
  decimals: number;
  currencySymbol?: string;
}

export const DEFAULT_NUMBER_FORMAT: NumberFormat = { kind: 'none', decimals: 0 };

export interface ColumnDef {
  id: string;
  name: string;
  type: ColumnType;
  width: number;
  visible: boolean;
  frozen: boolean;
  numberFormat: NumberFormat;
  style: CellStyle;
}

export type CellValue = string | number | boolean | null;

export interface RowRecord {
  id: string;
  cells: Record<string, CellValue>;
  styles?: Record<string, CellStyle>;
}

/** Mirrors the backend's OperationSpec registry (engine/src/tabula_engine/definition/operations/builtin.py)
 * one-for-one, so a workflow recorded here is a valid Workflow spec the engine can run unmodified. */
export type MathOperator = 'add' | 'subtract' | 'multiply' | 'divide';

export type WorkflowOperation =
  | { id: string; type: 'rename_column'; params: { column: string; new_name: string } }
  | { id: string; type: 'cast_column_type'; params: { column: string; target_type: ColumnType } }
  | { id: string; type: 'drop_columns'; params: { columns: string[] } }
  | { id: string; type: 'filter_rows'; params: { condition: ConditionExpr } }
  | { id: string; type: 'trim_whitespace'; params: { columns: string[] } }
  | {
      id: string;
      type: 'fill_null';
      params: { column: string; fill_type: 'constant' | 'column'; value: CellValue; source_column: string | null };
    }
  | { id: string; type: 'cast_to_integer'; params: { column: string } }
  | { id: string; type: 'cast_to_float'; params: { column: string } }
  | { id: string; type: 'cast_to_datetime'; params: { column: string; format: string | null } }
  | { id: string; type: 'split_column'; params: { column: string; delimiter: string; into: string[]; keep_original: boolean } }
  | {
      id: string;
      type: 'fill_constant';
      params: { column: string; fill_type: 'constant' | 'column'; value: CellValue; source_column: string | null };
    }
  | {
      id: string;
      type: 'math_operation';
      params: {
        column: string;
        operator: MathOperator;
        operand_type: 'constant' | 'column';
        operand: number | string;
        output_column: string | null;
      };
    }
  | { id: string; type: 'pad_string'; params: { column: string; length: number; pad_char: string; side: 'left' | 'right' } }
  | { id: string; type: 'change_case'; params: { column: string; case_type: 'upper' | 'lower' | 'title' } }
  | { id: string; type: 'reorder_column'; params: { column: string; before: string | null } }
  | { id: string; type: 'concat_columns'; params: { template: string; output_column: string } }
  | {
      id: string;
      type: 'replace';
      params: { column: string; find: string; replace: string; regex: boolean; match_case: boolean };
    }
  | {
      id: string;
      type: 'extract';
      params: { column: string; pattern: string; group: number; output_column: string | null };
    }
  | { id: string; type: 'map_values'; params: { column: string; mapping: Record<string, CellValue> } }
  | { id: string; type: 'round'; params: { column: string; decimals: number } }
  | { id: string; type: 'deduplicate'; params: { columns: string[] } }
  | { id: string; type: 'add_column'; params: { name: string; column_type: ColumnType; default_value: CellValue } }
  | { id: string; type: 'promote_header_row'; params: { row_index: number } }
  | { id: string; type: 'fix_decimal_places'; params: { column: string; decimals: number } }
  | {
      id: string;
      type: 'when';
      params: {
        cases: { condition: ConditionExpr; operations: WorkflowOperation[] }[];
        default: WorkflowOperation[] | null;
      };
    };

export interface SheetModel {
  id: string;
  name: string;
  columns: ColumnDef[];
  rows: RowRecord[];
  /** Declarative operations recorded as the user edits this sheet — the actual
   * workflow, kept separate from the row/column data it was demonstrated on. */
  workflowSteps: WorkflowOperation[];
}

export interface WorkbookModel {
  sheets: SheetModel[];
  activeSheetId: string;
}

export interface CellAddress {
  rowIdx: number;
  colIdx: number;
}

export interface SelectionRange {
  anchor: CellAddress;
  focus: CellAddress;
  /** true when the whole column(s) in range are selected (header click) */
  fullColumn?: boolean;
  /** true when the whole row(s) in range are selected (row-number click) */
  fullRow?: boolean;
}
