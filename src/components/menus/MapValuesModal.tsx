import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import { parseCellInput } from '../../model/format';
import type { CellValue, WorkflowOperation } from '../../model/types';
import type { AppCommand } from '../../commands/types';

interface Pair {
  from: string;
  to: string;
}

type MapValuesParams = Extract<WorkflowOperation, { type: 'map_values' }>['params'];

interface MapValuesModalProps {
  onClose: () => void;
  onApply?: (command: AppCommand) => void;
  initialParams?: MapValuesParams;
  onSaveDefinition?: (params: MapValuesParams) => void;
}

export function MapValuesModal({ onClose, onApply, initialParams, onSaveDefinition }: MapValuesModalProps) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(
    () => sheet.columns.find((c) => c.name === initialParams?.column)?.id ?? selectedColumnId ?? sheet.columns[0]?.id ?? '',
  );
  const [pairs, setPairs] = useState<Pair[]>(() => {
    if (!initialParams) return [{ from: '', to: '' }];
    const entries = Object.entries(initialParams.mapping).map(([from, to]) => ({
      from,
      to: to === null || to === undefined ? '' : String(to),
    }));
    return entries.length > 0 ? entries : [{ from: '', to: '' }];
  });

  const column = sheet.columns.find((c) => c.id === columnId);

  function updatePair(i: number, field: keyof Pair, value: string) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  function apply() {
    if (!column) return;
    const mapping: Record<string, CellValue> = {};
    for (const p of pairs) {
      if (p.from.trim() === '') continue;
      mapping[p.from] = parseCellInput(p.to, column.type);
    }
    if (Object.keys(mapping).length === 0) return;
    if (onSaveDefinition) {
      onSaveDefinition({ column: column.name, mapping });
      onClose();
      return;
    }
    const command: AppCommand = { type: 'MAP_VALUES', payload: { sheetId: sheet.id, columnId, mapping } };
    if (onApply) onApply(command);
    else dispatch(command);
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: substituir por de-para" onClose={onClose} width={420}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Troca valores exatos por outros, segundo uma tabela de correspondência. Valores fora da lista permanecem
        como estão.
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
        <div className="flex flex-col gap-1.5">
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                className="flex-1 rounded border px-2 py-1.5 text-[13px]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                value={p.from}
                onChange={(e) => updatePair(i, 'from', e.target.value)}
                placeholder="valor original"
              />
              <span className="text-[var(--color-text-subtle)]">→</span>
              <input
                className="flex-1 rounded border px-2 py-1.5 text-[13px]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                value={p.to}
                onChange={(e) => updatePair(i, 'to', e.target.value)}
                placeholder="novo valor"
              />
              <button
                type="button"
                disabled={pairs.length <= 1}
                onClick={() => setPairs((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded border px-2 py-1 disabled:opacity-30"
                style={{ borderColor: 'var(--color-border)' }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPairs((prev) => [...prev, { from: '', to: '' }])}
            className="w-fit text-[12px] text-[var(--color-accent)]"
          >
            + adicionar par
          </button>
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
