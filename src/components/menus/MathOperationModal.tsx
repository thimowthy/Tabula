import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import type { MathOperator, WorkflowOperation } from '../../model/types';
import type { AppCommand } from '../../commands/types';

const OPERATORS: { value: MathOperator; label: string }[] = [
  { value: 'add', label: '+ somar' },
  { value: 'subtract', label: '− subtrair' },
  { value: 'multiply', label: '× multiplicar' },
  { value: 'divide', label: '÷ dividir' },
];

type MathOperationParams = Extract<WorkflowOperation, { type: 'math_operation' }>['params'];

interface MathOperationModalProps {
  onClose: () => void;
  onApply?: (command: AppCommand) => void;
  initialParams?: MathOperationParams;
  onSaveDefinition?: (params: MathOperationParams) => void;
}

export function MathOperationModal({ onClose, onApply, initialParams, onSaveDefinition }: MathOperationModalProps) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(
    () => sheet.columns.find((c) => c.name === initialParams?.column)?.id ?? selectedColumnId ?? sheet.columns[0]?.id ?? '',
  );
  const [operator, setOperator] = useState<MathOperator>(initialParams?.operator ?? 'add');
  const [operandType, setOperandType] = useState<'constant' | 'column'>(initialParams?.operand_type ?? 'constant');
  const [constantValue, setConstantValue] = useState(
    initialParams?.operand_type === 'constant' ? String(initialParams.operand) : '0',
  );
  const [operandColumnId, setOperandColumnId] = useState(() => {
    if (initialParams?.operand_type === 'column') {
      const found = sheet.columns.find((c) => c.name === initialParams.operand)?.id;
      if (found) return found;
    }
    return sheet.columns[1]?.id ?? sheet.columns[0]?.id ?? '';
  });
  const [outputColumnName, setOutputColumnName] = useState(initialParams?.output_column ?? '');

  function apply() {
    if (onSaveDefinition) {
      const column = sheet.columns.find((c) => c.id === columnId);
      if (!column) return;
      onSaveDefinition({
        column: column.name,
        operator,
        operand_type: operandType,
        operand:
          operandType === 'constant' ? Number(constantValue) || 0 : (sheet.columns.find((c) => c.id === operandColumnId)?.name ?? ''),
        output_column: outputColumnName.trim() || null,
      });
      onClose();
      return;
    }
    const operand = operandType === 'constant' ? Number(constantValue) || 0 : operandColumnId;
    const command: AppCommand = {
      type: 'APPLY_MATH',
      payload: {
        sheetId: sheet.id,
        columnId,
        operator,
        operandType,
        operand,
        outputColumnName: outputColumnName.trim() || undefined,
      },
    };
    if (onApply) onApply(command);
    else dispatch(command);
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: operação matemática" onClose={onClose} width={400}>
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
          Operação
          <select
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={operator}
            onChange={(e) => setOperator(e.target.value as MathOperator)}
          >
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setOperandType('constant')}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: operandType === 'constant' ? 'var(--color-accent)' : 'var(--color-border)',
              color: operandType === 'constant' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Com um número
          </button>
          <button
            type="button"
            onClick={() => setOperandType('column')}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: operandType === 'column' ? 'var(--color-accent)' : 'var(--color-border)',
              color: operandType === 'column' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Com outra coluna
          </button>
        </div>
        {operandType === 'constant' ? (
          <input
            type="number"
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={constantValue}
            onChange={(e) => setConstantValue(e.target.value)}
          />
        ) : (
          <select
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={operandColumnId}
            onChange={(e) => setOperandColumnId(e.target.value)}
          >
            {sheet.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Salvar resultado em nova coluna (opcional)
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={outputColumnName}
            onChange={(e) => setOutputColumnName(e.target.value)}
            placeholder="deixe vazio para sobrescrever a coluna de origem"
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
