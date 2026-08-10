import { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { ColumnManagerModal } from './ColumnManagerModal';

export function ColumnsMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      >
        <Columns3 size={16} />
        <span>Colunas</span>
      </button>
      {open && <ColumnManagerModal onClose={() => setOpen(false)} />}
    </>
  );
}
