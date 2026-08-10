import { create } from 'zustand';
import { createEmptyWorkbook } from '../model/factory';
import type { SelectionRange, WorkbookModel } from '../model/types';
import { applyCommand } from '../commands/reducer';
import type { AppCommand } from '../commands/types';

const MAX_HISTORY = 100;

interface HistoryEntry {
  label: string;
  workbook: WorkbookModel;
}

/** columnId -> case-insensitive "contains" filter text */
export type SheetFilters = Record<string, string>;

/** Which top-level screen is showing — switched via the "Tabula" menu in the toolbar. */
export type AppView = 'editor' | 'workflows';

interface WorkbookStore {
  workbook: WorkbookModel;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selection: SelectionRange | null;
  /** sheetId -> per-column filters. View-only state, not part of undo history. */
  filters: Record<string, SheetFilters>;
  documentName: string;
  workflowPanelOpen: boolean;
  shortcutsModalOpen: boolean;
  view: AppView;

  dispatch: (command: AppCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undoLabel: () => string | null;
  redoLabel: () => string | null;

  setActiveSheet: (sheetId: string) => void;
  loadWorkbook: (workbook: WorkbookModel, documentName?: string) => void;
  setSelection: (selection: SelectionRange | null) => void;
  setFilter: (sheetId: string, columnId: string, value: string) => void;
  clearFilters: (sheetId: string) => void;
  setDocumentName: (name: string) => void;
  toggleWorkflowPanel: () => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setView: (view: AppView) => void;
}

export const useWorkbookStore = create<WorkbookStore>((set, get) => ({
  workbook: createEmptyWorkbook(),
  past: [],
  future: [],
  selection: null,
  filters: {},
  documentName: 'Sem título',
  workflowPanelOpen: false,
  shortcutsModalOpen: false,
  view: 'editor',

  dispatch: (command) => {
    const { workbook, past } = get();
    const { workbook: next, label } = applyCommand(workbook, command);
    if (next === workbook) return;
    const nextPast = [...past, { label, workbook }];
    if (nextPast.length > MAX_HISTORY) nextPast.shift();
    set({ workbook: next, past: nextPast, future: [] });
  },

  undo: () => {
    const { past, future, workbook } = get();
    if (past.length === 0) return;
    const entry = past[past.length - 1];
    set({
      workbook: entry.workbook,
      past: past.slice(0, -1),
      future: [...future, { label: entry.label, workbook }],
    });
  },

  redo: () => {
    const { past, future, workbook } = get();
    if (future.length === 0) return;
    const entry = future[future.length - 1];
    set({
      workbook: entry.workbook,
      future: future.slice(0, -1),
      past: [...past, { label: entry.label, workbook }],
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  undoLabel: () => get().past.at(-1)?.label ?? null,
  redoLabel: () => get().future.at(-1)?.label ?? null,

  setActiveSheet: (sheetId) => {
    set((state) => ({ workbook: { ...state.workbook, activeSheetId: sheetId }, selection: null }));
  },

  loadWorkbook: (workbook, documentName) => {
    set({
      workbook,
      past: [],
      future: [],
      selection: null,
      filters: {},
      documentName: documentName ?? 'Sem título',
    });
  },

  setSelection: (selection) => set({ selection }),
  setFilter: (sheetId, columnId, value) =>
    set((state) => {
      const sheetFilters = { ...(state.filters[sheetId] ?? {}) };
      if (value.trim() === '') delete sheetFilters[columnId];
      else sheetFilters[columnId] = value;
      return { filters: { ...state.filters, [sheetId]: sheetFilters } };
    }),
  clearFilters: (sheetId) => set((state) => ({ filters: { ...state.filters, [sheetId]: {} } })),
  setDocumentName: (documentName) => set({ documentName }),
  toggleWorkflowPanel: () => set((state) => ({ workflowPanelOpen: !state.workflowPanelOpen })),
  setShortcutsModalOpen: (shortcutsModalOpen) => set({ shortcutsModalOpen }),
  setView: (view) => set({ view }),
}));

export function useActiveSheet() {
  return useWorkbookStore((state) => state.workbook.sheets.find((s) => s.id === state.workbook.activeSheetId)!);
}
