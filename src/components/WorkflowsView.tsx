import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Inbox,
  Layers,
  Loader2,
  PencilLine,
  PlayCircle,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { isAdmin, useAuthStore } from '../store/useAuthStore';
import { describeOperation, OPERATION_BADGE } from '../workflow/describe';
import { listWorkflows, deleteWorkflow, type ServerWorkflow } from '../api/workflowsApi';
import { ApiError } from '../api/client';
import { RunWorkflowModal } from './menus/RunWorkflowModal';
import { PublishWorkflowModal } from './menus/PublishWorkflowModal';
import { EditWorkflowModal } from './menus/EditWorkflowModal';
import { ImportAndRunModal } from './menus/ImportAndRunModal';
import { WorkflowHistoryModal } from './menus/WorkflowHistoryModal';

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

export function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `há ${diffDays} dia${diffDays === 1 ? '' : 's'}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SecondaryButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  iconOnly,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] hover:bg-[var(--color-surface-hover)] disabled:opacity-40 disabled:hover:bg-transparent"
      style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text-subtle)' }}
    >
      <Icon size={13} />
      {!iconOnly && label}
    </button>
  );
}

/** The Workflows screen: a catalog of workflows explicitly published (named,
 * tagged, attributed to their creator) from a sheet's recorded steps — see
 * PublishWorkflowModal. This is server state (see /server), distinct from
 * the steps a sheet accumulates locally while being edited. */
export function WorkflowsView() {
  const authUser = useAuthStore((s) => s.user);

  const [workflows, setWorkflows] = useState<ServerWorkflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [runningWorkflow, setRunningWorkflow] = useState<ServerWorkflow | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ServerWorkflow | null>(null);
  const [importRunWorkflow, setImportRunWorkflow] = useState<ServerWorkflow | null>(null);
  const [historyWorkflow, setHistoryWorkflow] = useState<ServerWorkflow | null>(null);

  async function refresh() {
    setError(null);
    setRefreshing(true);
    try {
      setWorkflows(await listWorkflows());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os workflows.');
    } finally {
      setRefreshing(false);
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

  const query = search.trim().toLowerCase();
  const filtered = workflows ? workflows.filter((w) => w.name.toLowerCase().includes(query)) : [];
  const grouped = groupByTag(filtered);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-[18px] font-semibold text-[var(--color-text)]">
              <WorkflowIcon size={17} style={{ color: 'var(--color-accent)' }} />
              Workflows
            </h1>
            <p className="mt-1 max-w-md text-[13px] leading-relaxed text-[var(--color-text-subtle)]">
              Workflows publicados por tag, com nome e criador. Publique um a partir das etapas gravadas numa aba,
              ou execute um já existente aqui.
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] hover:bg-[var(--color-surface-hover)] disabled:opacity-60"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              disabled={!authUser}
              title={authUser ? undefined : 'Entre com sua conta para publicar um workflow'}
              className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
              style={{ background: 'var(--color-accent)' }}
            >
              Publicar workflow…
            </button>
          </div>
        </div>

        {workflows !== null && workflows.length > 0 && (
          <div className="relative mt-4">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
              style={{ color: 'var(--color-text-subtle)' }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar workflow por nome…"
              className="w-full rounded-md border py-1.5 pr-3 pl-8 text-[13px] outline-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            />
          </div>
        )}

        {error && (
          <div
            className="mt-5 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[12px]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-danger)' }}
          >
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {workflows === null && !error && (
          <div className="mt-12 flex flex-col items-center gap-2 text-center">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} />
            <p className="text-[13px] text-[var(--color-text-subtle)]">Carregando workflows…</p>
          </div>
        )}

        {workflows !== null && workflows.length === 0 && !error && (
          <div
            className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Inbox size={22} style={{ color: 'var(--color-text-subtle)' }} />
            <p className="text-[13px] font-medium text-[var(--color-text)]">Nenhum workflow publicado ainda</p>
            <p className="max-w-sm text-[12px] leading-relaxed text-[var(--color-text-subtle)]">
              Grave etapas numa aba (guia <strong>Operações</strong>, ou renomear/mover/excluir/adicionar coluna) e
              depois publique com um nome e tags.
            </p>
          </div>
        )}

        {workflows !== null && workflows.length > 0 && grouped.length === 0 && (
          <p className="mt-10 text-center text-[13px] text-[var(--color-text-subtle)]">
            Nenhum workflow encontrado para "{search.trim()}".
          </p>
        )}

        <div className="mt-5 flex flex-col gap-6">
          {grouped.map(([tag, tagWorkflows]) => (
            <section key={tag}>
              <h2
                className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase"
                style={{ color: 'var(--color-text-subtle)' }}
              >
                <Tag size={11} />
                {tag}
                <span
                  className="rounded-full px-1.5 py-px text-[10px] font-normal normal-case"
                  style={{ background: 'var(--color-surface)', color: 'var(--color-text-subtle)' }}
                >
                  {tagWorkflows.length}
                </span>
              </h2>
              <div className="flex flex-col gap-2.5">
                {tagWorkflows.map((workflow) => {
                  const expanded = expandedIds.has(workflow.id);
                  const hasSteps = workflow.steps.length > 0;
                  return (
                    <div
                      key={workflow.id}
                      className="rounded-xl border px-4 py-3.5 transition-shadow hover:shadow-sm"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">{workflow.name}</p>
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
                          <div
                            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
                            style={{ color: 'var(--color-text-subtle)' }}
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                                style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                              >
                                {workflow.creator.username.charAt(0).toUpperCase()}
                              </span>
                              {workflow.creator.username}
                            </span>
                            <span className="flex items-center gap-1">
                              <Layers size={11} />
                              {workflow.steps.length} etapa{workflow.steps.length === 1 ? '' : 's'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {formatRelativeDate(workflow.created_at)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRunningWorkflow(workflow)}
                          disabled={!hasSteps}
                          className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                          style={{ background: 'var(--color-accent)' }}
                        >
                          <PlayCircle size={14} />
                          Executar
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center gap-0.5 border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                        <SecondaryButton
                          icon={expanded ? ChevronUp : ChevronDown}
                          label={expanded ? 'Ocultar etapas' : 'Ver etapas'}
                          onClick={() => toggleExpanded(workflow.id)}
                        />
                        <SecondaryButton
                          icon={Upload}
                          label="Importar planilha"
                          onClick={() => setImportRunWorkflow(workflow)}
                          disabled={!hasSteps}
                        />
                        {authUser && (
                          <SecondaryButton
                            icon={PencilLine}
                            label="Editar"
                            onClick={() => setEditingWorkflow(workflow)}
                          />
                        )}
                        <SecondaryButton
                          icon={History}
                          label="Histórico"
                          onClick={() => setHistoryWorkflow(workflow)}
                        />
                        <div className="flex-1" />
                        {(authUser?.id === workflow.creator.id || isAdmin(authUser)) && (
                          <SecondaryButton
                            icon={Trash2}
                            label="Excluir workflow"
                            onClick={() => void handleDelete(workflow)}
                            danger
                            iconOnly
                          />
                        )}
                      </div>

                      {expanded && hasSteps && (
                        <ol className="mt-2.5 flex flex-col gap-1 border-t pt-2.5" style={{ borderColor: 'var(--color-border)' }}>
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
                  );
                })}
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
      {editingWorkflow && <EditWorkflowModal workflow={editingWorkflow} onClose={() => setEditingWorkflow(null)} />}
      {importRunWorkflow && (
        <ImportAndRunModal workflow={importRunWorkflow} onClose={() => setImportRunWorkflow(null)} />
      )}
      {historyWorkflow && (
        <WorkflowHistoryModal
          workflow={historyWorkflow}
          onClose={() => setHistoryWorkflow(null)}
          onRestored={() => void refresh()}
        />
      )}
    </div>
  );
}
