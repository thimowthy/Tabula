import { useEffect, useState } from 'react';
import { PlayCircle, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { describeOperation, OPERATION_BADGE } from '../workflow/describe';
import { listWorkflows, deleteWorkflow, type ServerWorkflow } from '../api/workflowsApi';
import { ApiError } from '../api/client';
import { RunWorkflowModal } from './menus/RunWorkflowModal';
import { PublishWorkflowModal } from './menus/PublishWorkflowModal';
import { ImportAndRunModal } from './menus/ImportAndRunModal';

const UNTAGGED = 'Sem tag';

function groupByTag(workflows: ServerWorkflow[]): [string, ServerWorkflow[]][] {
  const groups = new Map<string, ServerWorkflow[]>();
  for (const workflow of workflows) {
    const tags = workflow.tags.length > 0 ? workflow.tags : [UNTAGGED];
    for (const tag of tags) {
      const list = groups.get(tag) ?? [];
      list.push(workflow);
      groups.set(tag, list);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => (a === UNTAGGED ? 1 : b === UNTAGGED ? -1 : a.localeCompare(b)));
}

/** The Workflows screen: a catalog of workflows explicitly published (named,
 * tagged, attributed to their creator) from a sheet's recorded steps — see
 * PublishWorkflowModal. This is server state (see /server), distinct from
 * the steps a sheet accumulates locally while being edited. */
export function WorkflowsView() {
  const authUser = useAuthStore((s) => s.user);

  const [workflows, setWorkflows] = useState<ServerWorkflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [runningWorkflow, setRunningWorkflow] = useState<ServerWorkflow | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [importRunWorkflow, setImportRunWorkflow] = useState<ServerWorkflow | null>(null);

  async function refresh() {
    setError(null);
    try {
      setWorkflows(await listWorkflows());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os workflows.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(workflow: ServerWorkflow) {
    const token = useAuthStore.getState().token;
    if (!token) return;
    if (!window.confirm(`Excluir o workflow "${workflow.name}"?`)) return;
    try {
      await deleteWorkflow(workflow.id, token);
      await refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Não foi possível excluir o workflow.');
    }
  }

  const grouped = workflows ? groupByTag(workflows) : [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold text-[var(--color-text)]">Workflows</h1>
            <p className="mt-1 text-[13px] text-[var(--color-text-subtle)]">
              Workflows publicados por tag, com nome e criador. Publique um a partir das etapas gravadas numa aba,
              ou execute um já existente aqui.
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => void refresh()}
              className="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <RefreshCw size={13} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              disabled={!authUser}
              title={authUser ? undefined : 'Entre com sua conta para publicar um workflow'}
              className="rounded px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
              style={{ background: 'var(--color-accent)' }}
            >
              Publicar workflow…
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded border px-3 py-2 text-[12px] text-[var(--color-danger)]" style={{ borderColor: 'var(--color-border)' }}>
            {error}
          </p>
        )}

        {workflows === null && !error && (
          <p className="mt-6 text-[13px] text-[var(--color-text-subtle)]">Carregando workflows…</p>
        )}

        {workflows !== null && workflows.length === 0 && !error && (
          <p className="mt-6 text-[13px] leading-relaxed text-[var(--color-text-subtle)]">
            Nenhum workflow publicado ainda. Grave etapas numa aba (menu <strong>Operações</strong>, ou
            renomear/mover/excluir/adicionar coluna) e depois publique com um nome e tags.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-6">
          {grouped.map(([tag, tagWorkflows]) => (
            <section key={tag}>
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--color-text-subtle)] uppercase">
                {tag}
                <span className="ml-1.5 font-normal normal-case">
                  · {tagWorkflows.length} workflow{tagWorkflows.length === 1 ? '' : 's'}
                </span>
              </h2>
              <div className="flex flex-col gap-3">
                {tagWorkflows.map((workflow) => (
                  <div key={workflow.id} className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{workflow.name}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--color-text-subtle)]">
                          por <strong>{workflow.creator.username}</strong> · {workflow.steps.length} etapa
                          {workflow.steps.length === 1 ? '' : 's'}
                        </p>
                        {workflow.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {workflow.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full px-1.5 py-px text-[10px]"
                                style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(workflow.id)}
                          className="rounded border px-2.5 py-1.5 text-[12px]"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        >
                          {expandedIds.has(workflow.id) ? 'Ocultar etapas' : 'Ver etapas'}
                        </button>
                        {authUser?.id === workflow.creator.id && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(workflow)}
                            title="Excluir workflow"
                            className="rounded border px-2 py-1.5 text-[12px]"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-danger)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setImportRunWorkflow(workflow)}
                          disabled={workflow.steps.length === 0}
                          title="Importar uma planilha, rodar o workflow nela e baixar o resultado"
                          className="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] disabled:opacity-40"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        >
                          <Upload size={13} />
                          Importar planilha
                        </button>
                        <button
                          type="button"
                          onClick={() => setRunningWorkflow(workflow)}
                          disabled={workflow.steps.length === 0}
                          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
                          style={{ background: 'var(--color-accent)' }}
                        >
                          <PlayCircle size={14} />
                          Executar
                        </button>
                      </div>
                    </div>

                    {expandedIds.has(workflow.id) && workflow.steps.length > 0 && (
                      <ol className="mt-3 flex flex-col gap-1 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                        {workflow.steps.map((step, i) => (
                          <li key={step.id} className="flex gap-2 text-[12px]">
                            <span className="shrink-0 text-[var(--color-text-subtle)]">{i + 1}.</span>
                            <span className="shrink-0 rounded-sm bg-[var(--color-accent-soft)] px-1 py-px text-[9px] font-medium text-[var(--color-accent)]">
                              {OPERATION_BADGE[step.type]}
                            </span>
                            <span className="text-[var(--color-text)]">{describeOperation(step)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {runningWorkflow && (
        <RunWorkflowModal
          initialWorkflow={{ name: runningWorkflow.name, steps: runningWorkflow.steps }}
          onClose={() => setRunningWorkflow(null)}
        />
      )}
      {publishOpen && <PublishWorkflowModal onClose={() => setPublishOpen(false)} onPublished={() => void refresh()} />}
      {importRunWorkflow && (
        <ImportAndRunModal workflow={importRunWorkflow} onClose={() => setImportRunWorkflow(null)} />
      )}
    </div>
  );
}
