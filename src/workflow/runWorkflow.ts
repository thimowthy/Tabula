import type { AppCommand } from '../commands/types';
import type { SheetModel, WorkflowOperation } from '../model/types';
import { isConditionGroup, type ConditionExpr } from '../model/condition';

function resolveColumnId(sheet: SheetModel, name: string): string | null {
  return sheet.columns.find((c) => c.name === name)?.id ?? null;
}

type Resolved = { command: AppCommand } | { error: string };
type ResolvedCondition = { error: string } | ConditionExpr;

const missing = (name: string): Resolved => ({ error: `coluna "${name}" não encontrada` });

/** Recursively resolves a condition tree's column references by NAME (the
 * recorded/portable form) into columnIds (what AppCommand payloads use) —
 * the same id/name split every other operation already has, just walked
 * over a tree instead of a single field. Shared by `filter_rows` and `when`. */
function resolveCondition(sheet: SheetModel, condition: ConditionExpr): ResolvedCondition {
  if (isConditionGroup(condition)) {
    const conditions: ConditionExpr[] = [];
    for (const c of condition.conditions) {
      const resolved = resolveCondition(sheet, c);
      if ('error' in resolved) return resolved;
      conditions.push(resolved);
    }
    return { logic: condition.logic, conditions };
  }
  const columnId = resolveColumnId(sheet, condition.column);
  if (!columnId) return { error: `coluna "${condition.column}" não encontrada` };
  return { ...condition, column: columnId };
}

/** Resolves a branch's recorded WorkflowOperations into the AppCommands
 * `when` runs them as — recursing through resolveWorkflowStep is what makes
 * a nested `when` inside a branch replay correctly for free. */
function resolveBranch(sheet: SheetModel, operations: WorkflowOperation[]): { commands: AppCommand[] } | { error: string } {
  const commands: AppCommand[] = [];
  for (const op of operations) {
    const resolved = resolveWorkflowStep(op, sheet);
    if ('error' in resolved) return resolved;
    commands.push(resolved.command);
  }
  return { commands };
}

/** Translates one recorded WorkflowOperation into the AppCommand that already
 * implements it interactively — running an imported workflow is just
 * replaying its steps through the exact same reducer path a user's clicks
 * go through, so there's no second implementation of "what does cast_to_integer
 * actually do" to keep in sync. Column references are resolved by NAME
 * against the CURRENT state of the target sheet, since earlier steps in the
 * same run can rename, create, or drop columns later steps refer to. */
export function resolveWorkflowStep(step: WorkflowOperation, sheet: SheetModel): Resolved {
  const sheetId = sheet.id;
  switch (step.type) {
    case 'rename_column': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'RENAME_COLUMN', payload: { sheetId, columnId, name: step.params.new_name } } };
    }
    case 'cast_column_type': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'SET_COLUMN_TYPE', payload: { sheetId, columnId, columnType: step.params.target_type } } };
    }
    case 'drop_columns': {
      const columnIds = step.params.columns.map((n) => resolveColumnId(sheet, n)).filter((id): id is string => !!id);
      if (columnIds.length === 0) return { error: 'nenhuma das colunas informadas foi encontrada' };
      return { command: { type: 'DELETE_COLUMNS', payload: { sheetId, columnIds } } };
    }
    case 'filter_rows': {
      const condition = resolveCondition(sheet, step.params.condition);
      if ('error' in condition) return condition;
      return { command: { type: 'APPLY_FILTER_STEP', payload: { sheetId, condition } } };
    }
    case 'trim_whitespace': {
      const columnIds = step.params.columns.map((n) => resolveColumnId(sheet, n)).filter((id): id is string => !!id);
      return { command: { type: 'TRIM_WHITESPACE', payload: { sheetId, columnIds } } };
    }
    case 'fill_null': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      const fillType = step.params.fill_type ?? 'constant';
      let sourceColumnId: string | null = null;
      if (fillType === 'column') {
        if (!step.params.source_column) return { error: 'coluna de origem não informada' };
        sourceColumnId = resolveColumnId(sheet, step.params.source_column);
        if (!sourceColumnId) return missing(step.params.source_column);
      }
      return {
        command: {
          type: 'FILL_NULL',
          payload: { sheetId, columnId, fillType, value: step.params.value, sourceColumnId },
        },
      };
    }
    case 'cast_to_integer': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'CAST_TO_INTEGER', payload: { sheetId, columnId } } };
    }
    case 'cast_to_float': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'CAST_TO_FLOAT', payload: { sheetId, columnId } } };
    }
    case 'cast_to_datetime': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'CAST_TO_DATETIME', payload: { sheetId, columnId, format: step.params.format } } };
    }
    case 'split_column': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return {
        command: {
          type: 'SPLIT_COLUMN',
          payload: {
            sheetId,
            columnId,
            delimiter: step.params.delimiter,
            newNames: step.params.into,
            keepOriginal: step.params.keep_original,
          },
        },
      };
    }
    case 'fill_constant': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'FILL_CONSTANT', payload: { sheetId, columnId, value: step.params.value } } };
    }
    case 'math_operation': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      let operand: number | string = step.params.operand;
      if (step.params.operand_type === 'column') {
        const operandId = resolveColumnId(sheet, String(step.params.operand));
        if (!operandId) return missing(String(step.params.operand));
        operand = operandId;
      }
      return {
        command: {
          type: 'APPLY_MATH',
          payload: {
            sheetId,
            columnId,
            operator: step.params.operator,
            operandType: step.params.operand_type,
            operand,
            outputColumnName: step.params.output_column ?? undefined,
          },
        },
      };
    }
    case 'pad_string': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return {
        command: {
          type: 'PAD_STRING',
          payload: { sheetId, columnId, length: step.params.length, padChar: step.params.pad_char, side: step.params.side },
        },
      };
    }
    case 'reorder_column': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      const beforeColumnId = step.params.before ? resolveColumnId(sheet, step.params.before) : null;
      return { command: { type: 'MOVE_COLUMN', payload: { sheetId, columnId, beforeColumnId } } };
    }
    case 'concat_columns':
      return {
        command: {
          type: 'CONCAT_COLUMNS',
          payload: { sheetId, template: step.params.template, outputColumnName: step.params.output_column },
        },
      };
    case 'replace': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return {
        command: {
          type: 'REPLACE_TEXT',
          payload: {
            sheetId,
            columnId,
            find: step.params.find,
            replace: step.params.replace,
            regex: step.params.regex,
            matchCase: step.params.match_case,
          },
        },
      };
    }
    case 'extract': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return {
        command: {
          type: 'EXTRACT_TEXT',
          payload: {
            sheetId,
            columnId,
            pattern: step.params.pattern,
            group: step.params.group,
            outputColumnName: step.params.output_column ?? undefined,
          },
        },
      };
    }
    case 'map_values': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'MAP_VALUES', payload: { sheetId, columnId, mapping: step.params.mapping } } };
    }
    case 'round': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'ROUND_NUMBER', payload: { sheetId, columnId, decimals: step.params.decimals } } };
    }
    case 'deduplicate': {
      const columnIds = step.params.columns.map((n) => resolveColumnId(sheet, n)).filter((id): id is string => !!id);
      return { command: { type: 'DEDUPLICATE_ROWS', payload: { sheetId, columnIds } } };
    }
    case 'add_column':
      return {
        command: {
          type: 'ADD_COLUMN_STEP',
          payload: {
            sheetId,
            name: step.params.name,
            columnType: step.params.column_type,
            defaultValue: step.params.default_value,
          },
        },
      };
    case 'promote_header_row': {
      const row = sheet.rows[step.params.row_index];
      if (!row) return { error: `linha ${step.params.row_index + 1} não encontrada` };
      return { command: { type: 'PROMOTE_HEADER_ROW', payload: { sheetId, rowId: row.id } } };
    }
    case 'fix_decimal_places': {
      const columnId = resolveColumnId(sheet, step.params.column);
      if (!columnId) return missing(step.params.column);
      return { command: { type: 'FIX_DECIMAL_PLACES', payload: { sheetId, columnId, decimals: step.params.decimals } } };
    }
    case 'when': {
      const cases: { condition: ConditionExpr; operations: AppCommand[] }[] = [];
      for (const c of step.params.cases) {
        const condition = resolveCondition(sheet, c.condition);
        if ('error' in condition) return condition;
        const branch = resolveBranch(sheet, c.operations);
        if ('error' in branch) return branch;
        cases.push({ condition, operations: branch.commands });
      }
      let defaultCommands: AppCommand[] | null = null;
      if (step.params.default !== null) {
        const branch = resolveBranch(sheet, step.params.default);
        if ('error' in branch) return branch;
        defaultCommands = branch.commands;
      }
      return { command: { type: 'APPLY_WHEN', payload: { sheetId, cases, default: defaultCommands } } };
    }
    default:
      return { error: 'tipo de operação não suportado nesta versão do Tabula' };
  }
}

export interface StepOutcome {
  step: WorkflowOperation;
  reason: string;
}

export interface RunResult {
  appliedCount: number;
  skipped: StepOutcome[];
}

/** Runs every step in order against the sheet ``getSheet`` returns, dispatching
 * the resolved command for each. ``getSheet`` is called fresh before resolving
 * each step so column references reflect whatever the previous step just did. */
export function runWorkflowSteps(
  steps: WorkflowOperation[],
  dispatch: (command: AppCommand) => void,
  getSheet: () => SheetModel | undefined,
): RunResult {
  let appliedCount = 0;
  const skipped: StepOutcome[] = [];

  for (const step of steps) {
    const sheet = getSheet();
    if (!sheet) {
      skipped.push({ step, reason: 'aba de destino não encontrada' });
      continue;
    }
    let resolved: Resolved;
    try {
      resolved = resolveWorkflowStep(step, sheet);
    } catch {
      resolved = { error: 'falha ao interpretar a etapa' };
    }
    if ('error' in resolved) {
      skipped.push({ step, reason: resolved.error });
      continue;
    }
    dispatch(resolved.command);
    appliedCount++;
  }

  return { appliedCount, skipped };
}
