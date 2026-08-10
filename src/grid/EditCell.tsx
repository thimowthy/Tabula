import { useEffect, useRef } from 'react';
import type { RenderEditCellProps } from 'react-data-grid';
import type { ColumnDef } from '../model/types';
import type { GridRow } from './types';

export function makeEditCell(column: ColumnDef) {
  return function EditCell({ row, onRowChange, onClose }: RenderEditCellProps<GridRow>) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, []);

    if (column.type === 'boolean') {
      const value = row[column.id] === true;
      return (
        <div className="flex h-full items-center bg-[var(--color-bg)] px-2 outline outline-2 outline-[var(--color-accent)]">
          <input
            ref={inputRef}
            type="checkbox"
            checked={value}
            onChange={(e) => {
              onRowChange({ ...row, [column.id]: e.target.checked }, true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') onClose(true, true);
            }}
          />
        </div>
      );
    }

    const raw = row[column.id];
    const inputType = column.type === 'number' ? 'text' : column.type === 'date' ? 'date' : 'text';
    const displayValue = column.type === 'date' && typeof raw === 'string' ? raw.slice(0, 10) : (raw ?? '');

    return (
      <input
        ref={inputRef}
        className="h-full w-full border-2 border-[var(--color-accent)] bg-[var(--color-bg)] px-2 text-[13px] text-[var(--color-text)] outline-none"
        type={inputType}
        value={String(displayValue)}
        onChange={(e) => onRowChange({ ...row, [column.id]: e.target.value })}
        onBlur={() => onClose(true, false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose(false);
        }}
      />
    );
  };
}
