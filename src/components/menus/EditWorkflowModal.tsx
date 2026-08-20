import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { importWorkbookFile } from '../../io/xlsxIO';
import { runWorkflowSteps, type RunResult } from '../../workflow/runWorkflow';
import { describeOperation } from '../../workflow/describe';
import { Modal } from '../ui/Modal';
import type { ServerWorkflow } from '../../api/workflowsApi';

/** "Editar" on a published workflow: since there's no headless step editor,
 * its steps run for real against a sheet (an existing one or a freshly
 * imported file) — the same path "Executar" already uses — which populates
 * that sheet's `workflowSteps` as an ordinary side effect. That's what lands
 * the user on the real editing surface (WorkflowPanel: reorder/edit/delete
 * steps), with the sheet marked as bound to this workflow so the panel can
 * offer "save as a new version" (see SaveWorkflowVersionPanel). */
export function EditWorkflowModal({ workflow, onClose }: { workflow: ServerWorkflow; onClose: () => void }) {
  const allSheets = useWorkbookStore((s) => s.workbook.sheets);
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const setActiveSheet = useWorkbookStore((s) => s.setActiveSheet);
  const setView = useWorkbookStore((s) => s.setView);
  const setWorkflowPanelOpen = useWorkbookStore((s) => s.setWorkflowPanelOpen);
  const setEditingServerWorkflow = useWorkbookStore((s) => s.setEditingServerWorkflow);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<'sheet' | 'import'>(allSheets.length > 0 ? 'sheet' : 'import');
  const [sheetId, setSheetId] = useState(allSheets[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [readySheetId, setReadySheetId] = useState<string | null>(null);

  async function run() {
    if (running) return;
    if (target === 'import' && !file) return;
    if (target === 'sheet' && !sheetId) return;
    setRunning(true);
    setResult(null);
    try {
      let resolvedSheetId: string;
      if (target === 'import' && file) {
        const imported = await importWorkbookFile(file);
        dispatch({ type: 'IMPORT_SHEETS', payload: { sheets: imported.sheets } });
        resolvedSheetId = imported.sheets[0].id;
      } else {
        resolvedSheetId = sheetId;
      }
      const runResult = runWorkflowSteps(workflow.steps, dispatch, () =>
        useWorkbookStore.getState().workbook.sheets.find((s) => s.id === resolvedSheetId),
      );
      setResult(runResult);
      setReadySheetId(resolvedSheetId);
    } finally {
      setRunning(false);
    }
  }

  function goToEditor() {
    if (!readySheetId) return;
    setEditingServerWorkflow({ id: workflow.id, name: workflow.name, tags: workflow.tags, sheetId: readySheetId });
    setActiveSheet(readySheetId);
    setWorkflowPanelOpen(true);
    setView('editor');
    onClose();
  }

  const canRun = target === 'sheet' ? !!sheetId : !!file;

  return (
    <Modal title={`Editar "${workflow.name}"`} onClose={onClose} width={440}>
      <div className="flex flex-col gap-3">
        <p className="text-[12px] leading-relaxed text-[var(--color-text-subtle)]">
          Não há um editor de etapas sem dados — escolha uma aba já aberta ou importe uma planilha de exemplo para
          aplicar as etapas nela e poder editá-las (reordenar, ajustar ou remover) no painel de Operações.
        </p>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTarget('sheet')}
            disabled={allSheets.length === 0}
            className="flex-1 truncate rounded border px-2 py-1.5 text-[12px] disabled:opacity-40"
            style={{
              borderColor: target === 'sheet' ? 'var(--color-accent)' : 'var(--color-border)',
              color: target === 'sheet' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Aba já aberta
          </button>
          <button
            type="button"
            onClick={() => setTarget('import')}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: target === 'import' ? 'var(--color-accent)' : 'var(--color-border)',
              color: target === 'import' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Importar planilha
          </button>
        </div>

        {target === 'sheet' &&
          (allSheets.length > 0 ? (
            <select
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
            >
              {allSheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[12px] text-[var(--color-text-subtle)]">
              Não há nenhuma aba aberta neste workbook — importe uma planilha.
            </p>
          ))}

        {target === 'import' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded border border-dashed px-3 py-2 text-[13px]"
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text)' }}
            >
              <Upload size={16} />
              {file ? file.name : 'Escolher planilha de entrada (.xlsx, .csv)'}
            </button>
          </div>
        )}

        {!result && (
          <button
            type="button"
            onClick={() => void run()}
            disabled={!canRun || running}
            className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--color-accent)' }}
          >
            {running ? 'Abrindo…' : 'Abrir para edição'}
          </button>
        )}

        {result && (
          <div className="rounded border px-3 py-2 text-[12px]" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[var(--color-text)]">
              {result.appliedCount} etapa{result.appliedCount === 1 ? '' : 's'} carregada
              {result.appliedCount === 1 ? '' : 's'} para edição.
            </p>
            {result.skipped.length > 0 && (
              <>
                <p className="mt-1.5 text-[var(--color-danger)]">{result.skipped.length} etapa(s) não aplicada(s):</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {result.skipped.map((s, i) => (
                    <li key={i} className="text-[var(--color-text-subtle)]">
                      {describeOperation(s.step)} — {s.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              type="button"
              onClick={goToEditor}
              className="mt-2 rounded px-3 py-1.5 text-[13px] font-medium text-white"
              style={{ background: 'var(--color-accent)' }}
            >
              Ir para o Editor
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
