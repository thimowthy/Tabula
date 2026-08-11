import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import type { CellValue, WorkflowOperation } from '../../model/types';
import type { AppCommand } from '../../commands/types';

type ConcatColumnsParams = Extract<WorkflowOperation, { type: 'concat_columns' }>['params'];

function evaluatePreview(template: string, cells: Record<string, CellValue>, columnsByName: Map<string, string>): string {
  return template.replace(/\{([^{}]+)\}/g, (_match, name: string) => {
    const id = columnsByName.get(name);
    if (!id) return '';
    const v = cells[id];
    return v === null || v === undefined ? '' : String(v);
  });
}

interface ConcatColumnsModalProps {
  onClose: () => void;
  onApply?: (command: AppCommand) => void;
  initialParams?: ConcatColumnsParams;
  onSaveDefinition?: (params: ConcatColumnsParams) => void;
}

export function ConcatColumnsModal({ onClose, onApply, initialParams, onSaveDefinition }: ConcatColumnsModalProps) {
  const { sheet, displayRows } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [template, setTemplate] = useState(initialParams?.template ?? '');
  const [outputColumnName, setOutputColumnName] = useState(initialParams?.output_column ?? '');

  function insertPlaceholder(name: string) {
    setTemplate((prev) => `${prev}{${name}}`);
  }

  function apply() {
    if (!template.trim() || !outputColumnName.trim()) return;
    if (onSaveDefinition) {
      onSaveDefinition({ template, output_column: outputColumnName });
      onClose();
      return;
    }
    const command: AppCommand = { type: 'CONCAT_COLUMNS', payload: { sheetId: sheet.id, template, outputColumnName } };
    if (onApply) onApply(command);
    else dispatch(command);
    onClose();
  }

  const columnsByName = new Map(sheet.columns.map((c) => [c.name, c.id]));
  const previewRow = displayRows[0];

  return (
    <Modal title="Etapa do workflow: concatenar colunas" onClose={onClose} width={420}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Monte um texto combinando colunas, no estilo f-string: clique numa coluna para inserir{' '}
        <code className="rounded-sm bg-[var(--color-surface)] px-1">{'{Nome}'}</code> no molde.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {sheet.columns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => insertPlaceholder(c.name)}
              className="rounded-full border px-2 py-0.5 text-[11px]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Molde
          <input
            className="rounded border px-2 py-1.5 font-mono text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="{Nome} {Sobrenome}"
          />
        </label>
        {previewRow && template && (
          <div className="rounded border px-2 py-1.5 text-[12px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <span className="text-[var(--color-text-subtle)]">Prévia (linha 1): </span>
            <span className="text-[var(--color-text)]">{evaluatePreview(template, previewRow.cells, columnsByName)}</span>
          </div>
        )}
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Nova coluna
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={outputColumnName}
            onChange={(e) => setOutputColumnName(e.target.value)}
            placeholder="nome_completo"
          />
        </label>
        <button
          type="button"
          onClick={apply}
          disabled={!template.trim() || !outputColumnName.trim()}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          {onSaveDefinition ? 'Salvar alterações' : 'Aplicar e registrar etapa'}
        </button>
      </div>
    </Modal>
  );
}
