import { useActiveSheet, useWorkbookStore } from '../../store/useWorkbookStore';
import { Modal } from '../ui/Modal';

export function FilterModal({ onClose }: { onClose: () => void }) {
  const sheet = useActiveSheet();
  const filters = useWorkbookStore((s) => s.filters[sheet.id]) ?? {};
  const setFilter = useWorkbookStore((s) => s.setFilter);
  const clearFilters = useWorkbookStore((s) => s.clearFilters);

  return (
    <Modal title="Filtrar por coluna" onClose={onClose} width={400}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Mostra apenas linhas cujo valor contém o texto informado. Filtros não alteram os dados, apenas a exibição.
      </p>
      <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
        {sheet.columns.map((col) => (
          <label key={col.id} className="flex items-center gap-2 text-[12px]">
            <span className="w-28 shrink-0 truncate text-[var(--color-text)]">{col.name}</span>
            <input
              className="flex-1 rounded border px-2 py-1 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              placeholder="contém…"
              value={filters[col.id] ?? ''}
              onChange={(e) => setFilter(sheet.id, col.id, e.target.value)}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => clearFilters(sheet.id)}
        className="mt-3 rounded border px-3 py-1.5 text-[13px]"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        Limpar filtros
      </button>
    </Modal>
  );
}
