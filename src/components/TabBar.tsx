import { useRef, useState } from 'react';
import { useWorkbookStore } from '../store/useWorkbookStore';
import { ContextMenu, useContextMenu } from './ui/DropdownMenu';

export function TabBar() {
  const sheets = useWorkbookStore((s) => s.workbook.sheets);
  const activeSheetId = useWorkbookStore((s) => s.workbook.activeSheetId);
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const setActiveSheet = useWorkbookStore((s) => s.setActiveSheet);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const dragSourceRef = useRef<string | null>(null);
  const contextMenu = useContextMenu();
  const [contextSheetId, setContextSheetId] = useState<string | null>(null);

  function commitRename(sheetId: string) {
    const trimmed = draft.trim();
    if (trimmed) dispatch({ type: 'RENAME_SHEET', payload: { sheetId, name: trimmed } });
    setEditingId(null);
  }

  function handleDrop(targetId: string) {
    const sourceId = dragSourceRef.current;
    dragSourceRef.current = null;
    if (!sourceId || sourceId === targetId) return;
    const order = sheets.map((s) => s.id);
    const from = order.indexOf(sourceId);
    const to = order.indexOf(targetId);
    order.splice(from, 1);
    order.splice(to, 0, sourceId);
    dispatch({ type: 'REORDER_SHEETS', payload: { orderedSheetIds: order } });
  }

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-0.5 border-t px-1"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {sheets.map((sheet) => {
        const active = sheet.id === activeSheetId;
        return (
          <div
            key={sheet.id}
            draggable
            onDragStart={() => {
              dragSourceRef.current = sheet.id;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(sheet.id)}
            onClick={() => setActiveSheet(sheet.id)}
            onDoubleClick={() => {
              setEditingId(sheet.id);
              setDraft(sheet.name);
            }}
            onContextMenu={(e) => {
              setContextSheetId(sheet.id);
              contextMenu.open(e);
            }}
            className="group flex h-7 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-3 text-[12px]"
            style={{
              borderColor: 'var(--color-border)',
              background: active ? 'var(--color-bg)' : 'transparent',
              color: active ? 'var(--color-text)' : 'var(--color-text-subtle)',
              fontWeight: active ? 600 : 400,
            }}
            title="Clique duplo para renomear · botão direito para mais opções"
          >
            {editingId === sheet.id ? (
              <input
                autoFocus
                className="w-24 border border-[var(--color-accent)] bg-[var(--color-bg)] px-1 text-[12px] text-[var(--color-text)] outline-none"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => commitRename(sheet.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(sheet.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <span>{sheet.name}</span>
            )}
            {sheets.length > 1 && (
              <button
                type="button"
                className="hidden text-[13px] leading-none text-[var(--color-text-subtle)] hover:text-[var(--color-danger)] group-hover:inline"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'DELETE_SHEET', payload: { sheetId: sheet.id } });
                }}
                title="Excluir aba"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="ml-1 flex h-7 w-7 items-center justify-center rounded text-[15px] text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]"
        onClick={() => dispatch({ type: 'ADD_SHEET', payload: {} })}
        title="Nova aba"
      >
        +
      </button>
      {contextMenu.position && contextSheetId && (
        <ContextMenu
          x={contextMenu.position.x}
          y={contextMenu.position.y}
          onClose={() => {
            contextMenu.close();
            setContextSheetId(null);
          }}
          items={[
            {
              label: 'Renomear',
              onSelect: () => {
                const sheet = sheets.find((s) => s.id === contextSheetId);
                if (sheet) {
                  setEditingId(sheet.id);
                  setDraft(sheet.name);
                }
              },
            },
            {
              label: 'Duplicar',
              onSelect: () => dispatch({ type: 'DUPLICATE_SHEET', payload: { sheetId: contextSheetId } }),
            },
            { separator: true, label: '' },
            {
              label: 'Excluir',
              danger: true,
              disabled: sheets.length <= 1,
              onSelect: () => dispatch({ type: 'DELETE_SHEET', payload: { sheetId: contextSheetId } }),
            },
          ]}
        />
      )}
    </div>
  );
}
