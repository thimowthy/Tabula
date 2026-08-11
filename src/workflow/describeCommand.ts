import type { AppCommand } from '../commands/types';
import type { ColumnDef, WorkflowOperation } from '../model/types';
import { nameCondition } from '../model/condition';

function nameOf(columns: ColumnDef[], id: string): string {
  return columns.find((c) => c.id === id)?.name ?? id;
}

/** Turns a live, id-keyed AppCommand into the same name-keyed WorkflowOperation
 * shape the reducer would record for it — used only to preview a `when`
 * branch's operations (badge + describeOperation) before they've actually
 * been applied/recorded. Covers exactly the curated, per-row operation types
 * offered inside a when branch; anything else returns null. */
export function previewWorkflowOperation(command: AppCommand, columns: ColumnDef[]): WorkflowOperation | null {
  switch (command.type) {
    case 'FILL_NULL':
      return {
        id: command.type,
        type: 'fill_null',
        params: {
          column: nameOf(columns, command.payload.columnId),
          fill_type: command.payload.fillType,
          value: command.payload.value,
          source_column: command.payload.sourceColumnId ? nameOf(columns, command.payload.sourceColumnId) : null,
        },
      };
    case 'FILL_CONSTANT':
      return {
        id: command.type,
        type: 'fill_constant',
        params: { column: nameOf(columns, command.payload.columnId), value: command.payload.value },
      };
    case 'APPLY_MATH':
      return {
        id: command.type,
        type: 'math_operation',
        params: {
          column: nameOf(columns, command.payload.columnId),
          operator: command.payload.operator,
          operand_type: command.payload.operandType,
          operand:
            command.payload.operandType === 'column' ? nameOf(columns, String(command.payload.operand)) : command.payload.operand,
          output_column: command.payload.outputColumnName ?? null,
        },
      };
    case 'PAD_STRING':
      return {
        id: command.type,
        type: 'pad_string',
        params: {
          column: nameOf(columns, command.payload.columnId),
          length: command.payload.length,
          pad_char: command.payload.padChar,
          side: command.payload.side,
        },
      };
    case 'CONCAT_COLUMNS':
      return {
        id: command.type,
        type: 'concat_columns',
        params: { template: command.payload.template, output_column: command.payload.outputColumnName },
      };
    case 'REPLACE_TEXT':
      return {
        id: command.type,
        type: 'replace',
        params: {
          column: nameOf(columns, command.payload.columnId),
          find: command.payload.find,
          replace: command.payload.replace,
          regex: command.payload.regex,
          match_case: command.payload.matchCase,
        },
      };
    case 'EXTRACT_TEXT':
      return {
        id: command.type,
        type: 'extract',
        params: {
          column: nameOf(columns, command.payload.columnId),
          pattern: command.payload.pattern,
          group: command.payload.group,
          output_column: command.payload.outputColumnName ?? null,
        },
      };
    case 'MAP_VALUES':
      return {
        id: command.type,
        type: 'map_values',
        params: { column: nameOf(columns, command.payload.columnId), mapping: command.payload.mapping },
      };
    case 'ROUND_NUMBER':
      return {
        id: command.type,
        type: 'round',
        params: { column: nameOf(columns, command.payload.columnId), decimals: command.payload.decimals },
      };
    case 'FIX_DECIMAL_PLACES':
      return {
        id: command.type,
        type: 'fix_decimal_places',
        params: { column: nameOf(columns, command.payload.columnId), decimals: command.payload.decimals },
      };
    case 'CAST_TO_INTEGER':
      return { id: command.type, type: 'cast_to_integer', params: { column: nameOf(columns, command.payload.columnId) } };
    case 'CAST_TO_FLOAT':
      return { id: command.type, type: 'cast_to_float', params: { column: nameOf(columns, command.payload.columnId) } };
    case 'CAST_TO_DATETIME':
      return {
        id: command.type,
        type: 'cast_to_datetime',
        params: { column: nameOf(columns, command.payload.columnId), format: command.payload.format ?? null },
      };
    case 'TRIM_WHITESPACE':
      return {
        id: command.type,
        type: 'trim_whitespace',
        params: { columns: command.payload.columnIds.map((id) => nameOf(columns, id)) },
      };
    case 'APPLY_WHEN':
      return {
        id: command.type,
        type: 'when',
        params: {
          cases: command.payload.cases.map((c) => ({
            condition: nameCondition(c.condition, columns),
            operations: c.operations.map((op) => previewWorkflowOperation(op, columns)).filter((op): op is WorkflowOperation => !!op),
          })),
          default: command.payload.default
            ? command.payload.default.map((op) => previewWorkflowOperation(op, columns)).filter((op): op is WorkflowOperation => !!op)
            : null,
        },
      };
    default:
      return null;
  }
}
