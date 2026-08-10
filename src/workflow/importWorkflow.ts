import { v4 as uuid } from 'uuid';
import type { WorkflowOperation } from '../model/types';
import { OPERATION_BADGE } from './describe';

const KNOWN_TYPES = new Set(Object.keys(OPERATION_BADGE));

export interface SkippedRawStep {
  operationType: string;
  reason: string;
}

export interface ParsedWorkflow {
  name: string;
  version: number;
  steps: WorkflowOperation[];
  /** Steps present in the file but not recognized by this build — e.g. a
   * workflow saved by a newer version of Tabula. Surfaced so the import
   * doesn't silently drop them without a word. */
  skippedRawSteps: SkippedRawStep[];
}

/** Parses/validates a workflow JSON file (the shape `downloadWorkflow` writes,
 * which mirrors tabula_engine.definition.models.Workflow). Never throws on
 * merely-unexpected shapes inside `steps` — those become skippedRawSteps —
 * but does throw if the file isn't recognizable as a workflow at all. */
export function parseWorkflowJson(raw: unknown): ParsedWorkflow {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('O arquivo não é um workflow do Tabula válido.');
  }
  const obj = raw as Record<string, unknown>;
  const versions = Array.isArray(obj.versions) ? obj.versions : null;
  if (!versions || versions.length === 0) {
    throw new Error('O arquivo não contém nenhuma versão de workflow.');
  }
  const latest = versions[versions.length - 1] as Record<string, unknown>;
  const rawSteps = Array.isArray(latest.steps) ? latest.steps : [];

  const steps: WorkflowOperation[] = [];
  const skippedRawSteps: SkippedRawStep[] = [];

  for (const rawStep of rawSteps) {
    if (typeof rawStep !== 'object' || rawStep === null) continue;
    const s = rawStep as Record<string, unknown>;
    const operationType = typeof s.operation_type === 'string' ? s.operation_type : '';
    if (!KNOWN_TYPES.has(operationType)) {
      skippedRawSteps.push({
        operationType: operationType || '(desconhecido)',
        reason: 'tipo de operação não reconhecido nesta versão do Tabula',
      });
      continue;
    }
    const params = typeof s.params === 'object' && s.params !== null ? s.params : {};
    steps.push({
      id: typeof s.id === 'string' ? s.id : uuid(),
      type: operationType,
      params,
    } as WorkflowOperation);
  }

  return {
    name: typeof obj.name === 'string' ? obj.name : 'Workflow importado',
    version: typeof latest.version === 'number' ? latest.version : 1,
    steps,
    skippedRawSteps,
  };
}
