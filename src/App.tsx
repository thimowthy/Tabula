import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { TabBar } from './components/TabBar';
import { WorkflowPanel } from './components/WorkflowPanel';
import { WorkflowsView } from './components/WorkflowsView';
import { ShortcutsModal } from './components/ShortcutsModal';
import { SheetGrid } from './grid/SheetGrid';
import { useSelectionActions } from './grid/useSelectionActions';
import { useSelectionStyle } from './components/toolbar/useSelectionStyle';
import { useWorkbookStore } from './store/useWorkbookStore';

function App() {
  const undo = useWorkbookStore((s) => s.undo);
  const redo = useWorkbookStore((s) => s.redo);
  const workflowPanelOpen = useWorkbookStore((s) => s.workflowPanelOpen);
  const shortcutsModalOpen = useWorkbookStore((s) => s.shortcutsModalOpen);
  const setShortcutsModalOpen = useWorkbookStore((s) => s.setShortcutsModalOpen);
  const view = useWorkbookStore((s) => s.view);
  const { applyStyle, current } = useSelectionStyle();
  const { insertForSelection, deleteForSelection } = useSelectionActions();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if (!isEditing && e.key === '?') {
        e.preventDefault();
        setShortcutsModalOpen(true);
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod || isEditing) return;

      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        applyStyle({ bold: !current.bold });
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        applyStyle({ italic: !current.italic });
      } else if (e.shiftKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        insertForSelection();
      } else if (e.shiftKey && (e.key === '_' || e.key === '-')) {
        e.preventDefault();
        deleteForSelection();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, applyStyle, current, insertForSelection, deleteForSelection, setShortcutsModalOpen]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Toolbar />
      {view === 'workflows' ? (
        <WorkflowsView />
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              <SheetGrid />
            </div>
            {workflowPanelOpen && <WorkflowPanel />}
          </div>
          <TabBar />
        </>
      )}
      {shortcutsModalOpen && <ShortcutsModal onClose={() => setShortcutsModalOpen(false)} />}
    </div>
  );
}

export default App;
