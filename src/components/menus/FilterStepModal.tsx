import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import { parseCellInput } from '../../model/format';
import type { FilterOperator } from '../../model/types';

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: 'igual a' },
  { value: 'neq', label: 'diferente de' },
  { value: 'gt', label: 'maior que' },
  { value: 'gte', label: 'maior ou igual a' },
  { value: 'lt', label: 'menor que' },
  { value: 'lte', label: 'menor ou igual a' },
  { value: 'contains', label: 'contém' },
  { value: 'is_null', label: 'está vazio' },
  { value: 'not_null', label: 'não está vazio' },
];

export function FilterStepModal({ onClose }: { onClose: () => void }) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(selectedColumnId ?? sheet.columns[0]?.id ?? '');
  const [operator, setOperator] = useState<FilterOperator>('eq');
  const [value, setValue] = useState('');

  const column = sheet.columns.find((c) => c.id === columnId);
  const needsValue = operator !== 'is_null' && operator !== 'not_null';

  function apply() {
    if (!column) return;
    dispatch({
      type: 'APPLY_FILTER_STEP',
      payload: { sheetId: sheet.id, columnId, operator, value: needsValue ? parseCellInput(value, column.type) : null },
    });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: filtrar linhas" onClose={onClose} width={380}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Remove da planilha as linhas que não atendem à condição. Diferente do filtro de visualização, esta ação
        altera os dados e é registrada como etapa do workflow.
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
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Manter linhas onde a coluna...
          <select
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={operator}
            onChange={(e) => setOperator(e.target.value as FilterOperator)}
          >
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {needsValue && (
          <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Valor
            <input
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
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
