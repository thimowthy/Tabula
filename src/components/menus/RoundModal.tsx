import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import type { AppCommand } from '../../commands/types';
import type { WorkflowOperation } from '../../model/types';

type RoundParams = Extract<WorkflowOperation, { type: 'round' }>['params'];

interface RoundModalProps {
  onClose: () => void;
  onApply?: (command: AppCommand) => void;
  initialParams?: RoundParams;
  onSaveDefinition?: (params: RoundParams) => void;
}

export function RoundModal({ onClose, onApply, initialParams, onSaveDefinition }: RoundModalProps) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(
    () => sheet.columns.find((c) => c.name === initialParams?.column)?.id ?? selectedColumnId ?? sheet.columns[0]?.id ?? '',
  );
  const [decimals, setDecimals] = useState(initialParams?.decimals ?? 0);

  function apply() {
    if (onSaveDefinition) {
      const column = sheet.columns.find((c) => c.id === columnId);
      if (!column) return;
      onSaveDefinition({ column: column.name, decimals });
      onClose();
      return;
    }
    const command: AppCommand = { type: 'ROUND_NUMBER', payload: { sheetId: sheet.id, columnId, decimals } };
    if (onApply) onApply(command);
    else dispatch(command);
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: arredondar" onClose={onClose} width={360}>
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
          Casas decimais
          <input
            type="number"
            min={0}
            max={10}
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={decimals}
            onChange={(e) => setDecimals(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
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
