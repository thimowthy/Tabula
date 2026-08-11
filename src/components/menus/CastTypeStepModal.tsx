import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import type { AppCommand } from '../../commands/types';

type Target = 'integer' | 'float' | 'datetime';

/** One shape covering whichever of the three cast_to_* steps is being
 * edited — CastTypeStepModal is the one modal shared by all three, so
 * editing needs to know (and be able to change) which of them it is. */
export type CastTypeInitialParams =
  | { target: 'integer'; column: string }
  | { target: 'float'; column: string }
  | { target: 'datetime'; column: string; format: string | null };

const TARGET_OPERATION_TYPE: Record<Target, string> = {
  integer: 'cast_to_integer',
  float: 'cast_to_float',
  datetime: 'cast_to_datetime',
};

interface CastTypeStepModalProps {
  onClose: () => void;
  onApply?: (command: AppCommand) => void;
  initialParams?: CastTypeInitialParams;
  onSaveDefinition?: (operationType: string, params: Record<string, unknown>) => void;
}

export function CastTypeStepModal({ onClose, onApply, initialParams, onSaveDefinition }: CastTypeStepModalProps) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(
    () => sheet.columns.find((c) => c.name === initialParams?.column)?.id ?? selectedColumnId ?? sheet.columns[0]?.id ?? '',
  );
  const [target, setTarget] = useState<Target>(initialParams?.target ?? 'integer');
  const [format, setFormat] = useState(initialParams?.target === 'datetime' ? (initialParams.format ?? '') : '');

  function apply() {
    if (onSaveDefinition) {
      const column = sheet.columns.find((c) => c.id === columnId);
      if (!column) return;
      const params = target === 'datetime' ? { column: column.name, format: format || null } : { column: column.name };
      onSaveDefinition(TARGET_OPERATION_TYPE[target], params);
      onClose();
      return;
    }
    const command: AppCommand =
      target === 'integer'
        ? { type: 'CAST_TO_INTEGER', payload: { sheetId: sheet.id, columnId } }
        : target === 'float'
          ? { type: 'CAST_TO_FLOAT', payload: { sheetId: sheet.id, columnId } }
          : { type: 'CAST_TO_DATETIME', payload: { sheetId: sheet.id, columnId, format: format || null } };
    if (onApply) onApply(command);
    else dispatch(command);
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
          {onSaveDefinition ? 'Salvar alterações' : 'Aplicar e registrar etapa'}
        </button>
      </div>
    </Modal>
  );
}
