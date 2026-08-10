import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';

export function ReplaceStepModal({ onClose }: { onClose: () => void }) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(selectedColumnId ?? sheet.columns[0]?.id ?? '');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(true);

  function apply() {
    if (!find) return;
    dispatch({
      type: 'REPLACE_TEXT',
      payload: { sheetId: sheet.id, columnId, find, replace, regex, matchCase },
    });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: substituir texto" onClose={onClose} width={380}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Substitui trechos do texto numa única coluna, com suporte a expressão regular — diferente de "Localizar e
        substituir" (que age em várias colunas e não vira etapa do workflow).
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
          Localizar {regex && '(regex)'}
          <input
            autoFocus
            className="rounded border px-2 py-1.5 font-mono text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Substituir por
          <input
            className="rounded border px-2 py-1.5 font-mono text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-[var(--color-text)]">
          <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
          Usar expressão regular
        </label>
        <label className="flex items-center gap-2 text-[12px] text-[var(--color-text)]">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
          Diferenciar maiúsculas/minúsculas
        </label>
        <button
          type="button"
          onClick={apply}
          disabled={!find}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          Aplicar e registrar etapa
        </button>
      </div>
    </Modal>
  );
}
