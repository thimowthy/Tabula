import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import { parseCellInput } from '../../model/format';
import type { ColumnType } from '../../model/types';

const TYPE_OPTIONS: [ColumnType, string][] = [
  ['text', 'Texto'],
  ['number', 'Número'],
  ['date', 'Data'],
  ['boolean', 'Booleano'],
];

export function AddColumnModal({ onClose }: { onClose: () => void }) {
  const { sheet } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [name, setName] = useState('');
  const [columnType, setColumnType] = useState<ColumnType>('text');
  const [defaultValue, setDefaultValue] = useState('');

  function apply() {
    if (!name.trim()) return;
    dispatch({
      type: 'ADD_COLUMN_STEP',
      payload: {
        sheetId: sheet.id,
        name,
        columnType,
        defaultValue: parseCellInput(defaultValue, columnType),
      },
    });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: adicionar coluna" onClose={onClose} width={360}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Cria uma coluna nova, preenchida com o valor padrão em todas as linhas — deixe em branco para começar vazia.
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Nome da coluna
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova coluna"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Tipo
          <select
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={columnType}
            onChange={(e) => setColumnType(e.target.value as ColumnType)}
          >
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Valor padrão (opcional)
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={apply}
          disabled={!name.trim()}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          Aplicar e registrar etapa
        </button>
      </div>
    </Modal>
  );
}
