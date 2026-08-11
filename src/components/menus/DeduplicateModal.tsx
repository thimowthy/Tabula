import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import type { WorkflowOperation } from '../../model/types';

type DeduplicateParams = Extract<WorkflowOperation, { type: 'deduplicate' }>['params'];

interface DeduplicateModalProps {
  onClose: () => void;
  initialParams?: DeduplicateParams;
  onSaveDefinition?: (params: DeduplicateParams) => void;
}

export function DeduplicateModal({ onClose, initialParams, onSaveDefinition }: DeduplicateModalProps) {
  const { sheet } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        (initialParams?.columns ?? [])
          .map((name) => sheet.columns.find((c) => c.name === name)?.id)
          .filter((id): id is string => !!id),
      ),
  );

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
      onSaveDefinition({ columns: sheet.columns.filter((c) => selected.has(c.id)).map((c) => c.name) });
      onClose();
      return;
    }
    dispatch({ type: 'DEDUPLICATE_ROWS', payload: { sheetId: sheet.id, columnIds: Array.from(selected) } });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: remover linhas duplicadas" onClose={onClose} width={380}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Mantém apenas a primeira ocorrência de cada linha duplicada. Nenhuma coluna marcada = considera a linha
        inteira.
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
