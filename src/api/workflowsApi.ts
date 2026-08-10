import { apiFetch } from './client';
import type { WorkflowOperation } from '../model/types';

export interface ServerWorkflow {
  id: string;
  name: string;
  tags: string[];
  steps: WorkflowOperation[];
  creator: { id: string; username: string };
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

export async function deleteWorkflow(id: string, token: string): Promise<void> {
  await apiFetch<void>(`/workflows/${id}`, { method: 'DELETE', token });
}
