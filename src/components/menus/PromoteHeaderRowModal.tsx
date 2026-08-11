import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import type { RowRecord } from '../../model/types';

export function PromoteHeaderRowModal({ onClose }: { onClose: () => void }) {
  const { sheet, displayRows, rect } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const defaultRowId = (rect ? displayRows[rect.rowStart]?.id : undefined) ?? displayRows[0]?.id ?? '';
  const [rowId, setRowId] = useState(defaultRowId);

  function preview(row: RowRecord): string {
    return sheet.columns
      .slice(0, 4)
      .map((c) => row.cells[c.id])
      .filter((v) => v !== null && v !== undefined && v !== '')
      .join(' | ');
  }

  function apply() {
    if (!rowId) return;
    dispatch({ type: 'PROMOTE_HEADER_ROW', payload: { sheetId: sheet.id, rowId } });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: definir linha de cabeçalho" onClose={onClose} width={420}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Usa os valores da linha escolhida como novos nomes de coluna. Essa linha e todas as anteriores são removidas
        dos dados — útil quando o arquivo importado tem linhas de título antes do cabeçalho real.
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Linha
          <select
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={rowId}
            onChange={(e) => setRowId(e.target.value)}
          >
            {displayRows.slice(0, 50).map((r, i) => (
              <option key={r.id} value={r.id}>
                Linha {i + 1}: {preview(r) || '(vazia)'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={apply}
          disabled={!rowId}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--color-accent)' }}
        >
          Aplicar e registrar etapa
        </button>
      </div>
    </Modal>
  );
}
