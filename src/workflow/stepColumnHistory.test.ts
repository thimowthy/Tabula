import { describe, expect, it } from 'vitest';
import { currentColumnName, historicalColumnName, withCurrentColumnNames, withHistoricalColumnNames } from './stepColumnHistory';
import { createWorkflowStep } from './operations';
import type { WorkflowOperation } from '../model/types';

describe('currentColumnName / historicalColumnName', () => {
  it('tracks a name forward through a later rename', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('fill_constant', { column: 'A', fill_type: 'constant', value: '1', source_column: null }),
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
    ];
    expect(currentColumnName(steps, 0, 'A')).toBe('B');
  });

  it('follows a chain of renames', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('fill_constant', { column: 'A', fill_type: 'constant', value: '1', source_column: null }),
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
      createWorkflowStep('rename_column', { column: 'B', new_name: 'C' }),
    ];
    expect(currentColumnName(steps, 0, 'A')).toBe('C');
  });

  it('leaves the name alone when nothing renames it afterward', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
      createWorkflowStep('fill_constant', { column: 'B', fill_type: 'constant', value: '1', source_column: null }),
    ];
    expect(currentColumnName(steps, 1, 'B')).toBe('B');
  });

  it('historicalColumnName is the inverse of currentColumnName', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('fill_constant', { column: 'A', fill_type: 'constant', value: '1', source_column: null }),
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
      createWorkflowStep('rename_column', { column: 'B', new_name: 'C' }),
    ];
    expect(historicalColumnName(steps, 0, 'C')).toBe('A');
  });
});

describe('withCurrentColumnNames / withHistoricalColumnNames', () => {
  it('resolves an early step to the column`s current name for editing', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('fill_constant', { column: 'A', fill_type: 'constant', value: '1', source_column: null }),
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
    ];
    const forDisplay = withCurrentColumnNames(steps, 0);
    expect(forDisplay.type).toBe('fill_constant');
    expect((forDisplay as Extract<WorkflowOperation, { type: 'fill_constant' }>).params.column).toBe('B');
  });

  it('round-trips: editing and saving without changing the column preserves the original recorded name', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('fill_constant', { column: 'A', fill_type: 'constant', value: '1', source_column: null }),
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
    ];
    const forDisplay = withCurrentColumnNames(steps, 0) as Extract<WorkflowOperation, { type: 'fill_constant' }>;
    expect(forDisplay.params.column).toBe('B');

    // The modal saves back using whatever it resolved (current name "B") for
    // an unchanged selection.
    const savedByModal = { ...forDisplay, params: { ...forDisplay.params, value: '2' } };
    const forStorage = withHistoricalColumnNames(steps, 0, savedByModal) as Extract<WorkflowOperation, { type: 'fill_constant' }>;
    expect(forStorage.params.column).toBe('A');
    expect(forStorage.params.value).toBe('2');
  });

  it('translates a filter_rows condition tree', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('filter_rows', { condition: { column: 'A', operator: 'eq', value: 'x' } }),
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
    ];
    const forDisplay = withCurrentColumnNames(steps, 0) as Extract<WorkflowOperation, { type: 'filter_rows' }>;
    expect(forDisplay.params.condition).toEqual({ column: 'B', operator: 'eq', value: 'x' });
  });

  it('translates concat_columns template placeholders', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('concat_columns', { template: '{A}-{C}', output_column: 'Out' }),
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
    ];
    const forDisplay = withCurrentColumnNames(steps, 0) as Extract<WorkflowOperation, { type: 'concat_columns' }>;
    expect(forDisplay.params.template).toBe('{B}-{C}');
  });

  it('does not translate output_column-like fields that name a new column', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('extract', { column: 'A', pattern: '(\\d+)', group: 1, output_column: 'A_num' }),
      createWorkflowStep('rename_column', { column: 'A', new_name: 'B' }),
    ];
    const forDisplay = withCurrentColumnNames(steps, 0) as Extract<WorkflowOperation, { type: 'extract' }>;
    expect(forDisplay.params.column).toBe('B');
    expect(forDisplay.params.output_column).toBe('A_num');
  });

  it('translates fill_constant`s source_column when filling from another column', () => {
    const steps: WorkflowOperation[] = [
      createWorkflowStep('fill_constant', { column: 'Apelido', fill_type: 'column', value: null, source_column: 'Nome' }),
      createWorkflowStep('rename_column', { column: 'Nome', new_name: 'Nome Completo' }),
    ];
    const forDisplay = withCurrentColumnNames(steps, 0) as Extract<WorkflowOperation, { type: 'fill_constant' }>;
    expect(forDisplay.params.source_column).toBe('Nome Completo');
  });
});
