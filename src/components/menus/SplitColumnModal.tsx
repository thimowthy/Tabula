import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';

export function SplitColumnModal({ onClose }: { onClose: () => void }) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(selectedColumnId ?? sheet.columns[0]?.id ?? '');
  const [delimiter, setDelimiter] = useState(',');
  const [names, setNames] = useState<string[]>(['parte 1', 'parte 2']);
  const [keepOriginal, setKeepOriginal] = useState(false);

  function updateName(i: number, value: string) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }

  function apply() {
    const newNames = names.map((n) => n.trim()).filter(Boolean);
    if (newNames.length === 0) return;
    dispatch({
      type: 'SPLIT_COLUMN',
      payload: { sheetId: sheet.id, columnId, delimiter, newNames, keepOriginal },
    });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: dividir coluna" onClose={onClose} width={400}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Divide o texto de cada célula pelo delimitador e distribui as partes nas novas colunas, na ordem informada.
        Partes excedentes são descartadas.
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
          Delimitador
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[var(--color-text-subtle)]">Novas colunas (em ordem)</span>
          {names.map((name, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                className="flex-1 rounded border px-2 py-1.5 text-[13px]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                value={name}
                onChange={(e) => updateName(i, e.target.value)}
              />
              <button
                type="button"
                disabled={names.length <= 1}
                onClick={() => setNames((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded border px-2 disabled:opacity-30"
                style={{ borderColor: 'var(--color-border)' }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setNames((prev) => [...prev, `parte ${prev.length + 1}`])}
            className="w-fit text-[12px] text-[var(--color-accent)]"
          >
            + adicionar coluna
          </button>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-[var(--color-text)]">
          <input type="checkbox" checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)} />
          Manter coluna original
        </label>
        <button
          type="button"
          onClick={apply}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white"
          style={{ background: 'var(--color-accent)' }}
        >
          Aplicar e registrar etapa
        </button>
      </div>
    </Modal>
  );
}
