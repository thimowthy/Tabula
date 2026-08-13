import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import type { AppCommand } from '../../commands/types';
import type { WorkflowOperation } from '../../model/types';

type ChangeCaseParams = Extract<WorkflowOperation, { type: 'change_case' }>['params'];
type CaseType = ChangeCaseParams['case_type'];

const CASE_OPTIONS: [CaseType, string][] = [
  ['upper', 'MAIÚSCULAS'],
  ['lower', 'minúsculas'],
  ['title', 'Capitalizado'],
];

interface ChangeCaseModalProps {
  onClose: () => void;
  onApply?: (command: AppCommand) => void;
  initialParams?: ChangeCaseParams;
  onSaveDefinition?: (params: ChangeCaseParams) => void;
}

export function ChangeCaseModal({ onClose, onApply, initialParams, onSaveDefinition }: ChangeCaseModalProps) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(
    () => sheet.columns.find((c) => c.name === initialParams?.column)?.id ?? selectedColumnId ?? sheet.columns[0]?.id ?? '',
  );
  const [caseType, setCaseType] = useState<CaseType>(initialParams?.case_type ?? 'upper');

  function apply() {
    if (onSaveDefinition) {
      const column = sheet.columns.find((c) => c.id === columnId);
      if (!column) return;
      onSaveDefinition({ column: column.name, case_type: caseType });
      onClose();
      return;
    }
    const command: AppCommand = { type: 'CHANGE_CASE', payload: { sheetId: sheet.id, columnId, caseType } };
    if (onApply) onApply(command);
    else dispatch(command);
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: maiúsculas/minúsculas" onClose={onClose} width={380}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Converte o texto da coluna para maiúsculas, minúsculas, ou capitaliza a primeira letra de cada palavra.
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
          {CASE_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCaseType(value)}
              className="flex-1 rounded border px-2 py-1.5 text-[12px]"
              style={{
                borderColor: caseType === value ? 'var(--color-accent)' : 'var(--color-border)',
                color: caseType === value ? 'var(--color-accent)' : 'var(--color-text)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
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
