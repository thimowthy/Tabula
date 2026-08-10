import type { SheetModel } from '../model/types';

interface WorkflowStepJson {
  id: string;
  operation_type: string;
  params: Record<string, unknown>;
  label: string | null;
}

interface TargetColumnJson {
  name: string;
  type: string;
  required: boolean;
}

interface WorkflowVersionJson {
  version: number;
  steps: WorkflowStepJson[];
  target_schema: { columns: TargetColumnJson[] };
  created_at: string;
  changelog: string | null;
}

export interface WorkflowJson {
  id: string;
  name: string;
  versions: WorkflowVersionJson[];
}

/** Shape matches tabula_engine.definition.models.Workflow field-for-field, so
 * this file can be handed to the Python backend (Workflow.model_validate)
 * unmodified once that integration exists. */
export function buildWorkflowJson(sheet: SheetModel): WorkflowJson {
  return {
    id: sheet.id,
    name: sheet.name,
    versions: [
      {
        version: 1,
        steps: sheet.workflowSteps.map((op) => ({
          id: op.id,
          operation_type: op.type,
          params: op.params,
          label: null,
        })),
        target_schema: {
          columns: sheet.columns.map((c) => ({ name: c.name, type: c.type, required: true })),
        },
        created_at: new Date().toISOString(),
        changelog: null,
      },
    ],
  };
}

export function downloadWorkflow(sheet: SheetModel, filename: string) {
  const json = buildWorkflowJson(sheet);
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.json') ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
