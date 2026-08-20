import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useWorkbookStore, type EditingServerWorkflow } from '../../store/useWorkbookStore';
import { updateWorkflow } from '../../api/workflowsApi';
import { ApiError } from '../../api/client';
import type { SheetModel } from '../../model/types';

/** Shown in the WorkflowPanel footer whenever the active sheet's steps came
 * from "Editar" on a published workflow (see EditWorkflowModal) — pushes
 * whatever the user changed via the panel back as a new server version,
 * rather than only exporting to .json. Keyed by `binding.id` from the
 * parent so a fresh edit session always starts from the workflow's own
 * name/tags, not stale local state. */
export function SaveWorkflowVersionPanel({ sheet, binding }: { sheet: SheetModel; binding: EditingServerWorkflow }) {
  const token = useAuthStore((s) => s.token);
  const setEditingServerWorkflow = useWorkbookStore((s) => s.setEditingServerWorkflow);

  const [name, setName] = useState(binding.name);
  const [tagsInput, setTagsInput] = useState(binding.tags.join(', '));
  const [changelog, setChangelog] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!token || !name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await updateWorkflow(binding.id, { name: name.trim(), tags, steps: sheet.workflowSteps, changelog }, token);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a nova versão.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
      <p className="text-[11px] font-medium text-[var(--color-text-subtle)]">Editando workflow publicado</p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        <input
          className="rounded border px-2 py-1 text-[12px]"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="Nome do workflow"
        />
        <input
          className="rounded border px-2 py-1 text-[12px]"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
          value={tagsInput}
          onChange={(e) => {
            setTagsInput(e.target.value);
            setSaved(false);
          }}
          placeholder="Tags (separadas por vírgula)"
        />
        <input
          className="rounded border px-2 py-1 text-[12px]"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
          value={changelog}
          onChange={(e) => {
            setChangelog(e.target.value);
            setSaved(false);
          }}
          placeholder="O que mudou? (opcional)"
        />
      </div>

      {error && <p className="mt-1.5 text-[11px] text-[var(--color-danger)]">{error}</p>}
      {saved && !error && (
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-accent)' }}>
          Nova versão salva.
        </p>
      )}

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !name.trim()}
          className="flex-1 rounded px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          {saving ? 'Salvando…' : 'Salvar nova versão'}
        </button>
        <button
          type="button"
          onClick={() => setEditingServerWorkflow(null)}
          title="Parar de editar este workflow (a aba continua com as etapas atuais)"
          className="rounded border px-2.5 py-1.5 text-[12px]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-subtle)' }}
        >
          Encerrar
        </button>
      </div>
    </div>
  );
}
