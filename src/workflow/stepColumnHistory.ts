import { isConditionGroup, type ConditionExpr } from '../model/condition';
import type { WorkflowOperation } from '../model/types';

/**
 * A recorded step's `column`-ish params hold the name that column had *at
 * that point in the sequence* — required so replaying against a fresh sheet
 * (runWorkflow.ts) resolves each step against the right column as earlier
 * steps run. But editing an early step's params (WorkflowPanel) needs to
 * show/collect names from the sheet's *current*, fully-replayed state — if a
 * later `rename_column` step changed that column's name, the naive
 * `sheet.columns.find(c => c.name === recordedName)` lookup used by every
 * step-editing modal comes up empty and silently falls back to the first
 * column, corrupting the step on save. These two functions bridge that gap:
 * one translates a recorded name forward to its current name (for display),
 * the other translates a current name back to what was valid at that step's
 * position (for saving) — inverses of each other along the same rename
 * chain.
 */
export function currentColumnName(steps: WorkflowOperation[], stepIndex: number, recordedName: string): string {
  let name = recordedName;
  for (let i = stepIndex + 1; i < steps.length; i++) {
    const step = steps[i];
    if (step.type === 'rename_column' && step.params.column === name) name = step.params.new_name;
  }
  return name;
}

export function historicalColumnName(steps: WorkflowOperation[], stepIndex: number, currentName: string): string {
  let name = currentName;
  for (let i = steps.length - 1; i > stepIndex; i--) {
    const step = steps[i];
    if (step.type === 'rename_column' && step.params.new_name === name) name = step.params.column;
  }
  return name;
}

function translateCondition(condition: ConditionExpr, translate: (name: string) => string): ConditionExpr {
  if (isConditionGroup(condition)) {
    return { logic: condition.logic, conditions: condition.conditions.map((c) => translateCondition(c, translate)) };
  }
  return { ...condition, column: translate(condition.column) };
}

function translateTemplate(template: string, translate: (name: string) => string): string {
  return template.replace(/\{([^{}]+)\}/g, (_match, name: string) => `{${translate(name)}}`);
}

/** Rewrites every field of `step` that *references* an existing column
 * through `translate` — fields that *name a new column being created*
 * (`output_column`, `add_column`'s `name`, `split_column`'s `into`) are left
 * alone, since they aren't lookups. Recurses into `when`'s nested branch
 * operations, which reference columns at the same sequence position as the
 * `when` step itself. */
export function translateStepColumns(step: WorkflowOperation, translate: (name: string) => string): WorkflowOperation {
  switch (step.type) {
    case 'rename_column':
    case 'cast_column_type':
    case 'cast_to_integer':
    case 'cast_to_float':
    case 'cast_to_datetime':
    case 'split_column':
    case 'pad_string':
    case 'change_case':
    case 'replace':
    case 'extract':
    case 'map_values':
    case 'round':
    case 'fix_decimal_places':
      return { ...step, params: { ...step.params, column: translate(step.params.column) } } as WorkflowOperation;
    case 'drop_columns':
    case 'trim_whitespace':
    case 'deduplicate':
      return { ...step, params: { ...step.params, columns: step.params.columns.map(translate) } } as WorkflowOperation;
    case 'reorder_column':
      return {
        ...step,
        params: { ...step.params, column: translate(step.params.column), before: step.params.before ? translate(step.params.before) : null },
      };
    case 'filter_rows':
      return { ...step, params: { condition: translateCondition(step.params.condition, translate) } };
    case 'fill_null':
    case 'fill_constant':
      return {
        ...step,
        params: {
          ...step.params,
          column: translate(step.params.column),
          source_column: step.params.source_column ? translate(step.params.source_column) : null,
        },
      } as WorkflowOperation;
    case 'math_operation':
      return {
        ...step,
        params: {
          ...step.params,
          column: translate(step.params.column),
          operand: step.params.operand_type === 'column' ? translate(String(step.params.operand)) : step.params.operand,
        },
      };
    case 'concat_columns':
      return { ...step, params: { ...step.params, template: translateTemplate(step.params.template, translate) } };
    case 'when':
      return {
        ...step,
        params: {
          cases: step.params.cases.map((c) => ({
            condition: translateCondition(c.condition, translate),
            operations: c.operations.map((op) => translateStepColumns(op, translate)),
          })),
          default: step.params.default ? step.params.default.map((op) => translateStepColumns(op, translate)) : null,
        },
      };
    case 'add_column':
    case 'promote_header_row':
      return step;
  }
}

/** Step `steps[stepIndex]` with every column reference translated to its
 * current (live sheet) name — what step-editing modals should be given as
 * `initialParams` so they can find the right column in `sheet.columns`. */
export function withCurrentColumnNames(steps: WorkflowOperation[], stepIndex: number): WorkflowOperation {
  return translateStepColumns(steps[stepIndex], (name) => currentColumnName(steps, stepIndex, name));
}

/** The inverse, applied to what a modal produced (current-name-keyed) before
 * it's written back into `steps[stepIndex]`, so the stored step keeps
 * referencing the name that was valid at its position in the sequence. */
export function withHistoricalColumnNames(steps: WorkflowOperation[], stepIndex: number, edited: WorkflowOperation): WorkflowOperation {
  return translateStepColumns(edited, (name) => historicalColumnName(steps, stepIndex, name));
}
