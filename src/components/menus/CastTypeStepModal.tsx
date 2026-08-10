import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';

type Target = 'integer' | 'float' | 'datetime';

export function CastTypeStepModal({ onClose }: { onClose: () => void }) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(selectedColumnId ?? sheet.columns[0]?.id ?? '');
  const [target, setTarget] = useState<Target>('integer');
  const [format, setFormat] = useState('');

  function apply() {
    if (target === 'integer') dispatch({ type: 'CAST_TO_INTEGER', payload: { sheetId: sheet.id, columnId } });
    else if (target === 'float') dispatch({ type: 'CAST_TO_FLOAT', payload: { sheetId: sheet.id, columnId } });
    else dispatch({ type: 'CAST_TO_DATETIME', payload: { sheetId: sheet.id, columnId, format: format || null } });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: converter tipo" onClose={onClose} width={380}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Versões mais específicas do que o tipo básico da coluna: distingue inteiro de decimal, e data simples de
        data e hora.
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
        <div className="flex gap-1.5">
          {(
            [
              ['integer', 'Inteiro'],
              ['float', 'Decimal'],
              ['datetime', 'Data e hora'],
            ] as [Target, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTarget(value)}
              className="flex-1 rounded border px-2 py-1.5 text-[12px]"
              style={{
                borderColor: target === value ? 'var(--color-accent)' : 'var(--color-border)',
                color: target === value ? 'var(--color-accent)' : 'var(--color-text)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {target === 'datetime' && (
          <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Formato (opcional, ex.: %d/%m/%Y %H:%M)
            <input
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="deixe vazio para detecção automática"
            />
          </label>
        )}
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
