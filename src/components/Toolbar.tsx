import { useState } from 'react';
import { FileSpreadsheet, Keyboard, ListChecks, PlayCircle, Redo2, UserCircle2, Undo2, Workflow } from 'lucide-react';
import { useActiveSheet, useWorkbookStore } from '../store/useWorkbookStore';
import { useAuthStore } from '../store/useAuthStore';
import { Logo } from './Logo';
import { FileMenu } from './menus/FileMenu';
import { RunWorkflowModal } from './menus/RunWorkflowModal';
import { AuthModal } from './menus/AuthModal';
import { FormattingControls } from './toolbar/FormattingControls';
import { ToolbarButton } from './toolbar/ToolbarButton';
import { DropdownMenu } from './ui/DropdownMenu';

function Divider() {
  return <div className="mx-1.5 h-5 w-px shrink-0" style={{ background: 'var(--color-border)' }} />;
}

export function Toolbar() {
  const documentName = useWorkbookStore((s) => s.documentName);
  const setDocumentName = useWorkbookStore((s) => s.setDocumentName);
  const undo = useWorkbookStore((s) => s.undo);
  const redo = useWorkbookStore((s) => s.redo);
  const canUndo = useWorkbookStore((s) => s.past.length > 0);
  const canRedo = useWorkbookStore((s) => s.future.length > 0);
  const undoLabel = useWorkbookStore((s) => s.past.at(-1)?.label ?? null);
  const redoLabel = useWorkbookStore((s) => s.future.at(-1)?.label ?? null);
  const workflowPanelOpen = useWorkbookStore((s) => s.workflowPanelOpen);
  const toggleWorkflowPanel = useWorkbookStore((s) => s.toggleWorkflowPanel);
  const setShortcutsModalOpen = useWorkbookStore((s) => s.setShortcutsModalOpen);
  const view = useWorkbookStore((s) => s.view);
  const setView = useWorkbookStore((s) => s.setView);
  const activeSheet = useActiveSheet();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(documentName);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <div
      className="flex h-11 shrink-0 items-center gap-0.5 border-b px-2"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="mr-2 flex shrink-0 items-center pl-1">
        <DropdownMenu
          openOnHover
          trigger={
            <span className="tabula-brand flex items-center gap-1.5">
              <Logo className="tabula-brand-mark h-[18px] w-[18px]" />
              <span className="tabula-brand-text text-[15px] font-bold tracking-tight">Tabula</span>
            </span>
          }
          items={[
            { label: 'Editor', icon: FileSpreadsheet, onSelect: () => setView('editor') },
            { label: 'Workflows', icon: Workflow, onSelect: () => setView('workflows') },
          ]}
        />
      </div>

      {view === 'editor' && (
        <>
          <FileMenu />

          <Divider />

          <ToolbarButton
            icon={Undo2}
            label={undoLabel ? `Desfazer: ${undoLabel}` : 'Desfazer'}
            disabled={!canUndo}
            onClick={undo}
          />
          <ToolbarButton
            icon={Redo2}
            label={redoLabel ? `Refazer: ${redoLabel}` : 'Refazer'}
            disabled={!canRedo}
            onClick={redo}
          />

          <Divider />

          <FormattingControls />

          <Divider />

          <div className="relative flex shrink-0 items-center">
            <ToolbarButton
              icon={ListChecks}
              label="Mostrar/ocultar a pilha de operações do workflow"
              active={workflowPanelOpen}
              onClick={toggleWorkflowPanel}
            />
            {activeSheet.workflowSteps.length > 0 && (
              <span
                className="pointer-events-none absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold text-white"
                style={{ background: 'var(--color-accent)' }}
              >
                {activeSheet.workflowSteps.length}
              </span>
            )}
          </div>

          <ToolbarButton
            icon={PlayCircle}
            label="Importar e executar workflow"
            onClick={() => setRunModalOpen(true)}
          />
        </>
      )}

      <ToolbarButton
        icon={Keyboard}
        label="Atalhos de teclado (?)"
        onClick={() => setShortcutsModalOpen(true)}
      />

      <div className="flex-1" />

      {editingName ? (
        <input
          autoFocus
          className="rounded border px-2 py-1 text-[13px]"
          style={{ borderColor: 'var(--color-accent)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            setEditingName(false);
            if (draftName.trim()) setDocumentName(draftName.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraftName(documentName);
              setEditingName(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraftName(documentName);
            setEditingName(true);
          }}
          className="shrink-0 rounded px-2 py-1 text-[13px] text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]"
          title="Renomear documento"
        >
          {documentName}
        </button>
      )}

      <Divider />

      {authUser ? (
        <DropdownMenu
          align="right"
          trigger={
            <span className="flex items-center gap-1.5">
              <UserCircle2 size={16} />
              <span>{authUser.username}</span>
            </span>
          }
          items={[{ label: 'Sair', onSelect: logout }]}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
        >
          <UserCircle2 size={16} />
          Entrar
        </button>
      )}

      {runModalOpen && <RunWorkflowModal onClose={() => setRunModalOpen(false)} />}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
    </div>
  );
}
