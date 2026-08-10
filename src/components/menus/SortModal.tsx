import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';

export function SortModal({ onClose }: { onClose: () => void }) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(selectedColumnId ?? sheet.columns[0]?.id ?? '');
  const [direction, setDirection] = useState<'ASC' | 'DESC'>('ASC');

  function apply() {
    if (!columnId) return;
    dispatch({ type: 'SORT_ROWS', payload: { sheetId: sheet.id, columnId, direction } });
    onClose();
  }

  return (
    <Modal title="Ordenar" onClose={onClose} width={360}>
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDirection('ASC')}
            className="flex-1 rounded border px-2 py-1.5 text-[13px]"
            style={{
              borderColor: direction === 'ASC' ? 'var(--color-accent)' : 'var(--color-border)',
              color: direction === 'ASC' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Crescente (A→Z)
          </button>
          <button
            type="button"
            onClick={() => setDirection('DESC')}
            className="flex-1 rounded border px-2 py-1.5 text-[13px]"
            style={{
              borderColor: direction === 'DESC' ? 'var(--color-accent)' : 'var(--color-border)',
              color: direction === 'DESC' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Decrescente (Z→A)
          </button>
        </div>
        <button
          type="button"
          onClick={apply}
          className="mt-1 rounded px-3 py-1.5 text-[13px] font-medium text-white"
          style={{ background: 'var(--color-accent)' }}
        >
          Aplicar
        </button>
      </div>
    </Modal>
  );
}
