import { describe, expect, it } from 'vitest';
import { applyCommand } from './reducer';
import { createColumn, createEmptySheet, createRow } from '../model/factory';
import { createWorkflowStep } from '../workflow/operations';
import type { WorkbookModel } from '../model/types';

function makeWorkbook(values: string[]): { workbook: WorkbookModel; sheetId: string; columnId: string } {
  const column = createColumn({ name: 'A', type: 'text' });
  const rows = values.map((v) => createRow({ [column.id]: v }));
  const sheet = {
    ...createEmptySheet('Planilha1', 0, 0),
    columns: [column],
    rows,
    baseColumns: [column],
    baseRows: rows,
  };
  return {
    workbook: { sheets: [sheet], activeSheetId: sheet.id },
    sheetId: sheet.id,
    columnId: column.id,
  };
}

function makeTwoColumnWorkbook(
  rows: { target: string | null; source: string }[],
): { workbook: WorkbookModel; sheetId: string; targetId: string; sourceId: string } {
  const target = createColumn({ name: 'Apelido', type: 'text' });
  const source = createColumn({ name: 'Nome', type: 'text' });
  const rowRecords = rows.map((r) => createRow({ [target.id]: r.target, [source.id]: r.source }));
  const sheet = {
    ...createEmptySheet('Planilha1', 0, 0),
    columns: [target, source],
    rows: rowRecords,
    baseColumns: [target, source],
    baseRows: rowRecords,
  };
  return {
    workbook: { sheets: [sheet], activeSheetId: sheet.id },
    sheetId: sheet.id,
    targetId: target.id,
    sourceId: source.id,
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

describe('CHANGE_CASE', () => {
  it('converts to upper, lower and title case', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['ana maria', 'BRUNO']);
    const upper = applyCommand(workbook, {
      type: 'CHANGE_CASE',
      payload: { sheetId, columnId, caseType: 'upper' },
    });
    expect(upper.workbook.sheets[0].rows.map((r) => r.cells[columnId])).toEqual(['ANA MARIA', 'BRUNO']);

    const lower = applyCommand(workbook, {
      type: 'CHANGE_CASE',
      payload: { sheetId, columnId, caseType: 'lower' },
    });
    expect(lower.workbook.sheets[0].rows.map((r) => r.cells[columnId])).toEqual(['ana maria', 'bruno']);

    const title = applyCommand(workbook, {
      type: 'CHANGE_CASE',
      payload: { sheetId, columnId, caseType: 'title' },
    });
    expect(title.workbook.sheets[0].rows.map((r) => r.cells[columnId])).toEqual(['Ana Maria', 'Bruno']);
    expect(title.workbook.sheets[0].workflowSteps).toEqual([
      expect.objectContaining({ type: 'change_case', params: { column: 'A', case_type: 'title' } }),
    ]);
  });
});

describe('FILL_CONSTANT', () => {
  it('overwrites every row with a fixed value', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['x', '', 'y']);
    const result = applyCommand(workbook, {
      type: 'FILL_CONSTANT',
      payload: { sheetId, columnId, fillType: 'constant', value: 'z', sourceColumnId: null },
    });
    const sheet = result.workbook.sheets[0];
    expect(sheet.rows.map((r) => r.cells[columnId])).toEqual(['z', 'z', 'z']);
    expect(sheet.workflowSteps).toEqual([
      expect.objectContaining({
        type: 'fill_constant',
        params: { column: 'A', fill_type: 'constant', value: 'z', source_column: null },
      }),
    ]);
  });

  it('overwrites every row with the same-row value from another column', () => {
    const { workbook, sheetId, targetId, sourceId } = makeTwoColumnWorkbook([
      { target: null, source: 'Ana' },
      { target: 'Bru', source: 'Bruno' },
    ]);
    const result = applyCommand(workbook, {
      type: 'FILL_CONSTANT',
      payload: { sheetId, columnId: targetId, fillType: 'column', value: null, sourceColumnId: sourceId },
    });
    const sheet = result.workbook.sheets[0];
    expect(sheet.rows.map((r) => r.cells[targetId])).toEqual(['Ana', 'Bruno']);
    expect(sheet.workflowSteps).toEqual([
      expect.objectContaining({
        type: 'fill_constant',
        params: { column: 'Apelido', fill_type: 'column', value: null, source_column: 'Nome' },
      }),
    ]);
  });
});

function makeWorkbookWithSteps(names: string[]) {
  const steps = names.map((name) => createWorkflowStep('add_column', { name, column_type: 'text', default_value: null }));
  const sheet = { ...createEmptySheet('Planilha1', 0, 0), workflowSteps: steps };
  return { workbook: { sheets: [sheet], activeSheetId: sheet.id } as WorkbookModel, sheetId: sheet.id, steps };
}

function order(workbook: WorkbookModel): string[] {
  return workbook.sheets[0].workflowSteps.map((s) => (s.type === 'add_column' ? s.params.name : s.type));
}

describe('REORDER_WORKFLOW_STEP', () => {
  it('moves a step before another, shifting the ones in between', () => {
    const { workbook, sheetId, steps } = makeWorkbookWithSteps(['a', 'b', 'c', 'd']);
    const result = applyCommand(workbook, {
      type: 'REORDER_WORKFLOW_STEP',
      payload: { sheetId, stepId: steps[3].id, beforeStepId: steps[1].id },
    });
    expect(order(result.workbook)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves a step to the end when beforeStepId is null', () => {
    const { workbook, sheetId, steps } = makeWorkbookWithSteps(['a', 'b', 'c']);
    const result = applyCommand(workbook, {
      type: 'REORDER_WORKFLOW_STEP',
      payload: { sheetId, stepId: steps[0].id, beforeStepId: null },
    });
    expect(order(result.workbook)).toEqual(['b', 'c', 'a']);
  });

  it('swaps two adjacent steps', () => {
    const { workbook, sheetId, steps } = makeWorkbookWithSteps(['a', 'b', 'c']);
    const result = applyCommand(workbook, {
      type: 'REORDER_WORKFLOW_STEP',
      payload: { sheetId, stepId: steps[1].id, beforeStepId: steps[0].id },
    });
    expect(order(result.workbook)).toEqual(['b', 'a', 'c']);
  });

  it('is a no-op when a step is placed before itself', () => {
    const { workbook, sheetId, steps } = makeWorkbookWithSteps(['a', 'b', 'c']);
    const result = applyCommand(workbook, {
      type: 'REORDER_WORKFLOW_STEP',
      payload: { sheetId, stepId: steps[1].id, beforeStepId: steps[1].id },
    });
    expect(order(result.workbook)).toEqual(['a', 'b', 'c']);
  });
});

describe('DELETE_WORKFLOW_STEP', () => {
  it('removes only the targeted step, keeping the rest in order', () => {
    const { workbook, sheetId, steps } = makeWorkbookWithSteps(['a', 'b', 'c']);
    const result = applyCommand(workbook, {
      type: 'DELETE_WORKFLOW_STEP',
      payload: { sheetId, stepId: steps[1].id },
    });
    expect(order(result.workbook)).toEqual(['a', 'c']);
  });

  it('is a no-op when the step id does not exist', () => {
    const { workbook, sheetId } = makeWorkbookWithSteps(['a', 'b']);
    const result = applyCommand(workbook, {
      type: 'DELETE_WORKFLOW_STEP',
      payload: { sheetId, stepId: 'missing' },
    });
    expect(order(result.workbook)).toEqual(['a', 'b']);
  });
});

describe('SORT_ROWS', () => {
  it('keeps the original relative order of tied blank cells when sorting descending', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['Belo Horizonte', '', 'Curitiba', '', 'Aracaju']);
    const originalBlankIds = workbook.sheets[0].rows.filter((r) => r.cells[columnId] === '').map((r) => r.id);

    const result = applyCommand(workbook, { type: 'SORT_ROWS', payload: { sheetId, columnId, direction: 'DESC' } });
    const sortedBlankIds = result.workbook.sheets[0].rows.filter((r) => r.cells[columnId] === '').map((r) => r.id);

    expect(sortedBlankIds).toEqual(originalBlankIds);
  });

  it('sorts non-blank values descending', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['banana', '', 'abacaxi', 'cereja']);
    const result = applyCommand(workbook, { type: 'SORT_ROWS', payload: { sheetId, columnId, direction: 'DESC' } });
    const values = result.workbook.sheets[0].rows.map((r) => r.cells[columnId]);
    expect(values).toEqual(['', 'cereja', 'banana', 'abacaxi']);
  });

  it('sorts non-blank values ascending, with blanks last', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['banana', '', 'abacaxi', 'cereja']);
    const result = applyCommand(workbook, { type: 'SORT_ROWS', payload: { sheetId, columnId, direction: 'ASC' } });
    const values = result.workbook.sheets[0].rows.map((r) => r.cells[columnId]);
    expect(values).toEqual(['abacaxi', 'banana', 'cereja', '']);
  });
});

describe('CAST_TO_FLOAT', () => {
  it('parses Brazilian-formatted decimal strings instead of nulling them out', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['1.234,56', '12,5', '3']);
    const result = applyCommand(workbook, { type: 'CAST_TO_FLOAT', payload: { sheetId, columnId } });
    const sheet = result.workbook.sheets[0];
    expect(sheet.rows.map((r) => r.cells[columnId])).toEqual([1234.56, 12.5, 3]);
  });

  it('falls back to null only for values that are not numeric in either format', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['abc', '']);
    const result = applyCommand(workbook, { type: 'CAST_TO_FLOAT', payload: { sheetId, columnId } });
    const sheet = result.workbook.sheets[0];
    expect(sheet.rows.map((r) => r.cells[columnId])).toEqual([null, null]);
  });
});

describe('workflow step log edits recompute the grid, not just the log', () => {
  it('DELETE_WORKFLOW_STEP undoes that step\'s effect on the data', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['x', '', 'y']);
    const afterFill = applyCommand(workbook, {
      type: 'FILL_CONSTANT',
      payload: { sheetId, columnId, fillType: 'constant', value: 'z', sourceColumnId: null },
    });
    expect(afterFill.workbook.sheets[0].rows.map((r) => r.cells[columnId])).toEqual(['z', 'z', 'z']);

    const stepId = afterFill.workbook.sheets[0].workflowSteps[0].id;
    const afterDelete = applyCommand(afterFill.workbook, {
      type: 'DELETE_WORKFLOW_STEP',
      payload: { sheetId, stepId },
    });
    const sheet = afterDelete.workbook.sheets[0];
    expect(sheet.workflowSteps).toHaveLength(0);
    expect(sheet.rows.map((r) => r.cells[columnId])).toEqual(['x', '', 'y']);
  });

  it('UPDATE_WORKFLOW_STEP reapplies the step with the edited params', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['x', '', 'y']);
    const afterFill = applyCommand(workbook, {
      type: 'FILL_CONSTANT',
      payload: { sheetId, columnId, fillType: 'constant', value: 'z', sourceColumnId: null },
    });
    const step = afterFill.workbook.sheets[0].workflowSteps[0];
    const afterUpdate = applyCommand(afterFill.workbook, {
      type: 'UPDATE_WORKFLOW_STEP',
      payload: { sheetId, stepId: step.id, params: { ...(step.params as Record<string, unknown>), value: 'w' } },
    });
    const sheet = afterUpdate.workbook.sheets[0];
    expect(sheet.rows.map((r) => r.cells[columnId])).toEqual(['w', 'w', 'w']);
  });

  it('REORDER_WORKFLOW_STEP recomputes the data in the new order', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['']);
    const step1 = applyCommand(workbook, {
      type: 'FILL_CONSTANT',
      payload: { sheetId, columnId, fillType: 'constant', value: 'first', sourceColumnId: null },
    });
    const step2 = applyCommand(step1.workbook, {
      type: 'FILL_CONSTANT',
      payload: { sheetId, columnId, fillType: 'constant', value: 'second', sourceColumnId: null },
    });
    const sheet2 = step2.workbook.sheets[0];
    expect(sheet2.rows[0].cells[columnId]).toBe('second');

    const [firstStep, secondStep] = sheet2.workflowSteps;
    const reordered = applyCommand(step2.workbook, {
      type: 'REORDER_WORKFLOW_STEP',
      payload: { sheetId, stepId: secondStep.id, beforeStepId: firstStep.id },
    });
    expect(reordered.workbook.sheets[0].rows[0].cells[columnId]).toBe('first');
  });

  it('reports (without crashing) a later step that can no longer resolve once an earlier one it depended on is removed', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['a']);
    const renamed = applyCommand(workbook, { type: 'RENAME_COLUMN', payload: { sheetId, columnId, name: 'B' } });
    const renameStepId = renamed.workbook.sheets[0].workflowSteps[0].id;
    const filled = applyCommand(renamed.workbook, {
      type: 'FILL_CONSTANT',
      payload: { sheetId, columnId, fillType: 'constant', value: 'z', sourceColumnId: null },
    });

    const afterDelete = applyCommand(filled.workbook, {
      type: 'DELETE_WORKFLOW_STEP',
      payload: { sheetId, stepId: renameStepId },
    });
    expect(afterDelete.skippedSteps).toHaveLength(1);
    expect(afterDelete.skippedSteps![0].reason).toContain('B');
    // The fill_constant step stays in the log even though it couldn't be
    // replayed — the user can still see and fix it, nothing is silently lost.
    expect(afterDelete.workbook.sheets[0].workflowSteps).toHaveLength(1);
  });
});

describe('CAST_TO_INTEGER', () => {
  it('parses Brazilian-formatted decimal strings and truncates them', () => {
    const { workbook, sheetId, columnId } = makeWorkbook(['1.234,56', '12,9']);
    const result = applyCommand(workbook, { type: 'CAST_TO_INTEGER', payload: { sheetId, columnId } });
    const sheet = result.workbook.sheets[0];
    expect(sheet.rows.map((r) => r.cells[columnId])).toEqual([1234, 12]);
  });
});
