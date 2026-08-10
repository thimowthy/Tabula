import { v4 as uuid } from 'uuid';
import type { WorkflowOperation } from '../model/types';

export function createWorkflowStep<T extends WorkflowOperation['type']>(
  type: T,
  params: Extract<WorkflowOperation, { type: T }>['params'],
): WorkflowOperation {
  return { id: uuid(), type, params } as WorkflowOperation;
}
