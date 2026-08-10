import { useState } from 'react';
import { useActiveSheet, useWorkbookStore } from '../../store/useWorkbookStore';
import { Modal } from '../ui/Modal';

export function FindReplaceModal({ onClose }: { onClose: () => void }) {
  const sheet = useActiveSheet();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [columnId, setColumnId] = useState<string>('__all__');

  function apply() {
    if (!find) return;
    dispatch({
      type: 'FIND_REPLACE',
      payload: {
        sheetId: sheet.id,
        find,
        replace,
        matchCase,
        columnIds: columnId === '__all__' ? undefined : [columnId],
      },
    });
    onClose();
  }

  return (
    <Modal title="Localizar e substituir" onClose={onClose} width={380}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Localizar
          <input
            autoFocus
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Substituir por
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Restringir à coluna
          <select
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
          >
            <option value="__all__">Todas as colunas</option>
            {sheet.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[12px] text-[var(--color-text)]">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
          Diferenciar maiúsculas/minúsculas
        </label>
        <button
          type="button"
          onClick={apply}
          className="mt-1 rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--color-accent)' }}
          disabled={!find}
        >
          Substituir tudo
        </button>
      </div>
    </Modal>
  );
}
