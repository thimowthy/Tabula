import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import type { AppCommand } from '../../commands/types';
import type { WorkflowOperation } from '../../model/types';

type TrimWhitespaceParams = Extract<WorkflowOperation, { type: 'trim_whitespace' }>['params'];

interface TrimWhitespaceModalProps {
  onClose: () => void;
  onApply?: (command: AppCommand) => void;
  initialParams?: TrimWhitespaceParams;
  onSaveDefinition?: (params: TrimWhitespaceParams) => void;
}

export function TrimWhitespaceModal({ onClose, onApply, initialParams, onSaveDefinition }: TrimWhitespaceModalProps) {
  const { sheet, rect, visibleColumns } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (initialParams) {
      return new Set(
        initialParams.columns.map((name) => sheet.columns.find((c) => c.name === name)?.id).filter((id): id is string => !!id),
      );
    }
    return new Set(rect ? visibleColumns.slice(rect.colStart, rect.colEnd + 1).map((c) => c.id) : []);
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    if (onSaveDefinition) {
      const columns = sheet.columns.filter((c) => selected.has(c.id)).map((c) => c.name);
      onSaveDefinition({ columns });
      onClose();
      return;
    }
    const command: AppCommand = { type: 'TRIM_WHITESPACE', payload: { sheetId: sheet.id, columnIds: Array.from(selected) } };
    if (onApply) onApply(command);
    else dispatch(command);
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: remover espaços em excesso" onClose={onClose} width={380}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Remove espaços no início/fim do texto de cada célula. Nenhuma coluna marcada = aplica em todas as colunas de
        texto.
      </p>
      <div className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto">
        {sheet.columns.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-[12px] text-[var(--color-text)]">
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            {c.name}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={apply}
        className="mt-3 rounded px-3 py-1.5 text-[13px] font-medium text-white"
        style={{ background: 'var(--color-accent)' }}
      >
        {onSaveDefinition ? 'Salvar alterações' : 'Aplicar e registrar etapa'}
      </button>
    </Modal>
  );
}
