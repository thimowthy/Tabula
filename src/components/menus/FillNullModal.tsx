import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import { parseCellInput } from '../../model/format';
import type { AppCommand } from '../../commands/types';
import type { WorkflowOperation } from '../../model/types';

type FillNullParams = Extract<WorkflowOperation, { type: 'fill_null' }>['params'];

interface FillNullModalProps {
  onClose: () => void;
  /** When present, "Aplicar" hands the built command to this instead of
   * dispatching it — used to compose the op into a `when` branch. */
  onApply?: (command: AppCommand) => void;
  /** Pre-fills the form from an already-recorded step (name-keyed). */
  initialParams?: FillNullParams;
  /** When present, "Aplicar" rewrites the recorded step's params in place
   * instead of applying anything — used to edit a step from the workflow panel. */
  onSaveDefinition?: (params: FillNullParams) => void;
}

export function FillNullModal({ onClose, onApply, initialParams, onSaveDefinition }: FillNullModalProps) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(
    () => sheet.columns.find((c) => c.name === initialParams?.column)?.id ?? selectedColumnId ?? sheet.columns[0]?.id ?? '',
  );
  const [fillType, setFillType] = useState<'constant' | 'column'>(initialParams?.fill_type ?? 'constant');
  const [value, setValue] = useState(initialParams?.value !== undefined && initialParams?.value !== null ? String(initialParams.value) : '');
  const [sourceColumnId, setSourceColumnId] = useState(
    () =>
      sheet.columns.find((c) => c.name === initialParams?.source_column)?.id ??
      sheet.columns[1]?.id ??
      sheet.columns[0]?.id ??
      '',
  );

  const column = sheet.columns.find((c) => c.id === columnId);

  function apply() {
    if (!column) return;
    if (onSaveDefinition) {
      onSaveDefinition({
        column: column.name,
        fill_type: fillType,
        value: fillType === 'constant' ? parseCellInput(value, column.type) : null,
        source_column: fillType === 'column' ? (sheet.columns.find((c) => c.id === sourceColumnId)?.name ?? null) : null,
      });
      onClose();
      return;
    }
    const command: AppCommand = {
      type: 'FILL_NULL',
      payload: {
        sheetId: sheet.id,
        columnId,
        fillType,
        value: fillType === 'constant' ? parseCellInput(value, column.type) : null,
        sourceColumnId: fillType === 'column' ? sourceColumnId : null,
      },
    };
    if (onApply) onApply(command);
    else dispatch(command);
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: preencher vazios" onClose={onClose} width={360}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Preenche apenas as células vazias da coluna escolhida, com um valor fixo ou com o valor de outra coluna na
        mesma linha.
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
          <button
            type="button"
            onClick={() => setFillType('constant')}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: fillType === 'constant' ? 'var(--color-accent)' : 'var(--color-border)',
              color: fillType === 'constant' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Com um valor
          </button>
          <button
            type="button"
            onClick={() => setFillType('column')}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: fillType === 'column' ? 'var(--color-accent)' : 'var(--color-border)',
              color: fillType === 'column' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Com outra coluna
          </button>
        </div>
        {fillType === 'constant' ? (
          <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Valor padrão
            <input
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Coluna de origem
            <select
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={sourceColumnId}
              onChange={(e) => setSourceColumnId(e.target.value)}
            >
              {sheet.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
