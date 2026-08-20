import { apiFetch } from './client';
import type { WorkflowOperation } from '../model/types';

export interface ServerWorkflow {
  id: string;
  name: string;
  tags: string[];
  steps: WorkflowOperation[];
  version: number;
  creator: { id: string; username: string };
  created_at: string;
}

export interface ServerWorkflowVersion {
  version: number;
  name: string;
  tags: string[];
  steps: WorkflowOperation[];
  changelog: string | null;
  editor: { id: string; username: string };
  created_at: string;
}

interface WireStep {
  id: string;
  operation_type: string;
  params: Record<string, unknown>;
}

function toWireSteps(steps: WorkflowOperation[]): WireStep[] {
  return steps.map((s) => ({ id: s.id, operation_type: s.type, params: s.params }));
}

function fromWireSteps(steps: WireStep[]): WorkflowOperation[] {
  return steps.map((s) => ({ id: s.id, type: s.operation_type, params: s.params }) as WorkflowOperation);
}

interface RawServerWorkflow extends Omit<ServerWorkflow, 'steps'> {
  steps: WireStep[];
}

function fromWire(raw: RawServerWorkflow): ServerWorkflow {
  return { ...raw, steps: fromWireSteps(raw.steps) };
}

interface RawServerWorkflowVersion extends Omit<ServerWorkflowVersion, 'steps'> {
  steps: WireStep[];
}

function versionFromWire(raw: RawServerWorkflowVersion): ServerWorkflowVersion {
  return { ...raw, steps: fromWireSteps(raw.steps) };
}

export async function listWorkflows(tag?: string): Promise<ServerWorkflow[]> {
  const query = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  const raw = await apiFetch<RawServerWorkflow[]>(`/workflows${query}`);
  return raw.map(fromWire);
}

export async function createWorkflow(
  input: { name: string; tags: string[]; steps: WorkflowOperation[] },
  token: string,
): Promise<ServerWorkflow> {
  const raw = await apiFetch<RawServerWorkflow>('/workflows', {
    method: 'POST',
    token,
    body: { name: input.name, tags: input.tags, steps: toWireSteps(input.steps) },
  });
  return fromWire(raw);
}

/** Any signed-in user may edit any workflow — the server appends a new
 * version snapshot rather than overwriting history (see server/.../main.py). */
export async function updateWorkflow(
  id: string,
  input: { name: string; tags: string[]; steps: WorkflowOperation[]; changelog?: string },
  token: string,
): Promise<ServerWorkflow> {
  const raw = await apiFetch<RawServerWorkflow>(`/workflows/${id}`, {
    method: 'PUT',
    token,
    body: {
      name: input.name,
      tags: input.tags,
      steps: toWireSteps(input.steps),
      changelog: input.changelog?.trim() || null,
    },
  });
  return fromWire(raw);
}

export async function listWorkflowVersions(id: string): Promise<ServerWorkflowVersion[]> {
  const raw = await apiFetch<RawServerWorkflowVersion[]>(`/workflows/${id}/versions`);
  return raw.map(versionFromWire);
}

export async function deleteWorkflow(id: string, token: string): Promise<void> {
  await apiFetch<void>(`/workflows/${id}`, { method: 'DELETE', token });
}
