import { useEffect, useRef, useState } from 'react';
import type { ColumnDef } from '../model/types';

const TYPE_BADGE: Record<ColumnDef['type'], string> = {
  text: 'TXT',
  number: '#',
  date: 'DATA',
  boolean: 'S/N',
};

interface HeaderCellProps {
  column: ColumnDef;
  letter: string;
  onRename: (name: string) => void;
  onSelectColumn: (shiftKey: boolean) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function HeaderCell({ column, letter, onRename, onSelectColumn, onContextMenu }: HeaderCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== column.name) onRename(trimmed);
    else setDraft(column.name);
  }

  return (
    <div
      className="flex h-full w-full flex-col justify-center gap-0.5 px-2 select-none"
      onMouseDown={(e) => {
        if (editing) return;
        onSelectColumn(e.shiftKey);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (editing) return;
        onContextMenu(e);
      }}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-subtle)]">
        <span className="font-semibold tracking-wide">{letter}</span>
        <span className="rounded-sm bg-[var(--color-accent-soft)] px-1 py-px text-[9px] font-medium text-[var(--color-accent)]">
          {TYPE_BADGE[column.type]}
        </span>
        {column.frozen && <span title="Coluna congelada">❄</span>}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          className="w-full rounded-sm border border-[var(--color-accent)] bg-[var(--color-bg)] px-1 text-[12px] text-[var(--color-text)] outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(column.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div
          className="truncate text-[12px] font-medium text-[var(--color-text)]"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          title="Duplo clique para renomear"
        >
          {column.name}
        </div>
      )}
    </div>
  );
}
