import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import { ConditionEditor } from '../ui/ConditionEditor';
import { emptyCondition, idCondition, nameCondition, type ConditionExpr } from '../../model/condition';
import type { WorkflowOperation } from '../../model/types';

type FilterRowsParams = Extract<WorkflowOperation, { type: 'filter_rows' }>['params'];

interface FilterStepModalProps {
  onClose: () => void;
  initialParams?: FilterRowsParams;
  onSaveDefinition?: (params: FilterRowsParams) => void;
}

export function FilterStepModal({ onClose, initialParams, onSaveDefinition }: FilterStepModalProps) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [condition, setCondition] = useState<ConditionExpr>(() =>
    initialParams ? idCondition(initialParams.condition, sheet.columns) : emptyCondition(selectedColumnId ?? sheet.columns[0]?.id ?? ''),
  );

  function apply() {
    if (onSaveDefinition) {
      onSaveDefinition({ condition: nameCondition(condition, sheet.columns) });
      onClose();
      return;
    }
    dispatch({ type: 'APPLY_FILTER_STEP', payload: { sheetId: sheet.id, condition } });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: filtrar linhas" onClose={onClose} width={460}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Remove da planilha as linhas que não atendem à condição — pode combinar várias condições com E/OU. Diferente
        do filtro de visualização, esta ação altera os dados e é registrada como etapa do workflow.
      </p>
      <div className="flex flex-col gap-3">
        <ConditionEditor columns={sheet.columns} value={condition} onChange={setCondition} />
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
