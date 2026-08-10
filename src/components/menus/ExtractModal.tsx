import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';

export function ExtractModal({ onClose }: { onClose: () => void }) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(selectedColumnId ?? sheet.columns[0]?.id ?? '');
  const [pattern, setPattern] = useState('');
  const [group, setGroup] = useState(1);
  const [outputColumnName, setOutputColumnName] = useState('');

  function apply() {
    if (!pattern) return;
    dispatch({
      type: 'EXTRACT_TEXT',
      payload: { sheetId: sheet.id, columnId, pattern, group, outputColumnName: outputColumnName.trim() || undefined },
    });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: extrair texto" onClose={onClose} width={400}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Extrai parte do texto usando uma expressão regular. O grupo 1 é o conteúdo do primeiro{' '}
        <code className="rounded-sm bg-[var(--color-surface)] px-1">(...)</code> do padrão; grupo 0 é o trecho
        inteiro que casou.
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Coluna
          <select
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
          >
            {sheet.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Padrão (regex)
          <input
            autoFocus
            className="rounded border px-2 py-1.5 font-mono text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="^([^@]+)@"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Grupo de captura
          <input
            type="number"
            min={0}
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={group}
            onChange={(e) => setGroup(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Salvar resultado em nova coluna (opcional)
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={outputColumnName}
            onChange={(e) => setOutputColumnName(e.target.value)}
            placeholder="deixe vazio para sobrescrever a coluna de origem"
          />
        </label>
        <button
          type="button"
          onClick={apply}
          disabled={!pattern}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          Aplicar e registrar etapa
        </button>
      </div>
    </Modal>
  );
}
