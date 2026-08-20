import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, History, Loader2, RotateCcw } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { describeOperation, OPERATION_BADGE } from '../../workflow/describe';
import {
  listWorkflowVersions,
  updateWorkflow,
  type ServerWorkflow,
  type ServerWorkflowVersion,
} from '../../api/workflowsApi';
import { ApiError } from '../../api/client';
import { Modal } from '../ui/Modal';
import { formatRelativeDate } from '../WorkflowsView';

/** Version history for a published workflow — lists every appended
 * ``WorkflowVersion`` snapshot (see server main.py:update_workflow) with who
 * changed what and when, and lets any signed-in user restore an older one.
 * Restoring isn't a distinct server operation: it just calls the same
 * update endpoint with that snapshot's content, which appends yet another
 * new version rather than rewriting history — consistent with "editing
 * never overwrites, only appends". */
export function WorkflowHistoryModal({
  workflow,
  onClose,
  onRestored,
}: {
  workflow: ServerWorkflow;
  onClose: () => void;
  onRestored: () => void;
}) {
  const authUser = useAuthStore((s) => s.user);

  const [versions, setVersions] = useState<ServerWorkflowVersion[] | null>(null);
  const [currentVersion, setCurrentVersion] = useState(workflow.version);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  async function loadVersions() {
    setError(null);
    try {
      setVersions(await listWorkflowVersions(workflow.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o histórico.');
    }
  }

  useEffect(() => {
    void loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  async function restore(version: ServerWorkflowVersion) {
    const token = useAuthStore.getState().token;
    if (!token || restoring !== null) return;
    if (!window.confirm(`Restaurar a versão ${version.version}? Isso cria uma nova versão com esse conteúdo.`)) return;
    setRestoring(version.version);
    setError(null);
    try {
      const restored = await updateWorkflow(
        workflow.id,
        { name: version.name, tags: version.tags, steps: version.steps, changelog: `Restaurado da versão ${version.version}` },
        token,
      );
      setCurrentVersion(restored.version);
      await loadVersions();
      onRestored();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível restaurar essa versão.');
    } finally {
      setRestoring(null);
    }
  }

  return (
    <Modal title={`Histórico: "${workflow.name}"`} onClose={onClose} width={480}>
      <div className="flex flex-col gap-3">
        {error && (
          <p className="text-[12px] text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}

        {versions === null && !error && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} />
            <p className="text-[12px] text-[var(--color-text-subtle)]">Carregando histórico…</p>
          </div>
        )}

        {versions !== null && (
          <ol className="flex flex-col gap-2">
            {versions.map((v) => {
              const isCurrent = v.version === currentVersion;
              const isExpanded = expanded === v.version;
              return (
                <li key={v.version} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="flex items-center gap-1 text-[13px] font-medium text-[var(--color-text)]">
                          <History size={12} style={{ color: 'var(--color-text-subtle)' }} />
                          Versão {v.version}
                        </span>
                        {isCurrent && (
                          <span
                            className="rounded-full px-1.5 py-px text-[10px] font-medium"
                            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                          >
                            Atual
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] text-[var(--color-text)]">
                        {v.changelog || (v.version === 1 ? 'Publicação inicial' : 'Sem descrição')}
                      </p>
                      <div
                        className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]"
                        style={{ color: 'var(--color-text-subtle)' }}
                      >
                        <span>{v.editor.username}</span>
                        <span>{formatRelativeDate(v.created_at)}</span>
                        <span>
                          {v.steps.length} etapa{v.steps.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : v.version)}
                        title={isExpanded ? 'Ocultar etapas' : 'Ver etapas'}
                        className="rounded p-1 hover:bg-[var(--color-surface-hover)]"
                        style={{ color: 'var(--color-text-subtle)' }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {authUser && !isCurrent && (
                        <button
                          type="button"
                          onClick={() => void restore(v)}
                          disabled={restoring !== null}
                          title="Restaurar esta versão"
                          className="flex items-center gap-1 rounded border px-1.5 py-1 text-[11px] disabled:opacity-40"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        >
                          <RotateCcw size={11} />
                          {restoring === v.version ? 'Restaurando…' : 'Restaurar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && v.steps.length > 0 && (
                    <ol className="mt-2 flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                      {v.steps.map((step, i) => (
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
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Modal>
  );
}
