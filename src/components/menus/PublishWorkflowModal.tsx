import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useAuthStore } from '../../store/useAuthStore';
import { createWorkflow } from '../../api/workflowsApi';
import { ApiError } from '../../api/client';
import { Modal } from '../ui/Modal';

export function PublishWorkflowModal({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const allSheets = useWorkbookStore((s) => s.workbook.sheets);
  const sheets = allSheets.filter((sheet) => sheet.workflowSteps.length > 0);
  const token = useAuthStore((s) => s.token);

  const [sheetId, setSheetId] = useState(sheets[0]?.id ?? '');
  const sheet = sheets.find((s) => s.id === sheetId);

  const [name, setName] = useState(sheet?.name ?? '');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectSheet(id: string) {
    setSheetId(id);
    const s = sheets.find((x) => x.id === id);
    if (s) setName(s.name);
  }

  async function publish() {
    if (!token || !sheet || !name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await createWorkflow({ name: name.trim(), tags, steps: sheet.workflowSteps }, token);
      onPublished();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível publicar o workflow.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Publicar workflow" onClose={onClose} width={400}>
      {!token ? (
        <p className="text-[13px] text-[var(--color-text-subtle)]">Entre com sua conta para publicar um workflow.</p>
      ) : sheets.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-subtle)]">
          Nenhuma aba tem etapas registradas ainda. Volte ao <strong>Editor</strong> e grave algumas etapas primeiro.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Aba de origem
            <select
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={sheetId}
              onChange={(e) => selectSheet(e.target.value)}
            >
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.workflowSteps.length} etapa{s.workflowSteps.length === 1 ? '' : 's'})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Nome do workflow
            <input
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Tags (separadas por vírgula)
            <input
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="vendas, limpeza"
            />
          </label>

          {error && <p className="text-[12px] text-[var(--color-danger)]">{error}</p>}

          <button
            type="button"
            onClick={() => void publish()}
            disabled={submitting || !name.trim()}
            className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--color-accent)' }}
          >
            {submitting ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      )}
    </Modal>
  );
}
