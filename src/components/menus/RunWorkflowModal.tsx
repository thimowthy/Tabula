import { useRef, useState } from 'react';
import { FileJson, Upload } from 'lucide-react';
import { useActiveSheet, useWorkbookStore } from '../../store/useWorkbookStore';
import { importWorkbookFile } from '../../io/xlsxIO';
import { parseWorkflowJson, type ParsedWorkflow } from '../../workflow/importWorkflow';
import { runWorkflowSteps, type RunResult } from '../../workflow/runWorkflow';
import { describeOperation, OPERATION_BADGE } from '../../workflow/describe';
import { Modal } from '../ui/Modal';
import type { WorkflowOperation } from '../../model/types';

interface InitialWorkflow {
  name: string;
  steps: WorkflowOperation[];
  /** A sheet id to leave out of the "apply to another sheet" choices — set
   * when the workflow came from a sheet already in the workbook, so it
   * doesn't offer to run the workflow back onto its own source. */
  excludeSheetId?: string;
}

interface RunWorkflowModalProps {
  onClose: () => void;
  /** When provided, the workflow to run is already known — its own recorded
   * steps (from a sheet) or a published one fetched from the server —
   * instead of a file the user picks. The file-picker step is skipped and
   * "apply to" offers other sheets in the workbook rather than "the current
   * sheet". */
  initialWorkflow?: InitialWorkflow;
}

export function RunWorkflowModal({ onClose, initialWorkflow }: RunWorkflowModalProps) {
  const activeSheet = useActiveSheet();
  const allSheets = useWorkbookStore((s) => s.workbook.sheets);
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const setActiveSheet = useWorkbookStore((s) => s.setActiveSheet);
  const setView = useWorkbookStore((s) => s.setView);

  const workflowInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  const otherSheets = allSheets.filter((s) => s.id !== initialWorkflow?.excludeSheetId);

  const [parsed, setParsed] = useState<ParsedWorkflow | null>(
    initialWorkflow
      ? { name: initialWorkflow.name, version: 1, steps: initialWorkflow.steps, skippedRawSteps: [] }
      : null,
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [target, setTarget] = useState<'current' | 'otherSheet' | 'import'>(
    initialWorkflow ? 'otherSheet' : 'current',
  );
  const [targetSheetId, setTargetSheetId] = useState(otherSheets[0]?.id ?? '');
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [ranSheetId, setRanSheetId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function handleWorkflowFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResult(null);
    try {
      const json = JSON.parse(await file.text());
      setParsed(parseWorkflowJson(json));
      setParseError(null);
    } catch {
      setParsed(null);
      setParseError('Não foi possível ler esse arquivo como um workflow do Tabula (.json).');
    }
  }

  function handleDataFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportedFile(e.target.files?.[0] ?? null);
  }

  async function execute() {
    if (!parsed || running) return;
    if (target === 'import' && !importedFile) return;
    if (target === 'otherSheet' && !targetSheetId) return;
    setRunning(true);
    try {
      let sheetId: string;
      if (target === 'import' && importedFile) {
        const imported = await importWorkbookFile(importedFile);
        dispatch({ type: 'IMPORT_SHEETS', payload: { sheets: imported.sheets } });
        sheetId = imported.sheets[0].id;
        setActiveSheet(sheetId);
      } else if (target === 'otherSheet') {
        sheetId = targetSheetId;
      } else {
        sheetId = activeSheet.id;
      }
      const runResult = runWorkflowSteps(parsed.steps, dispatch, () =>
        useWorkbookStore.getState().workbook.sheets.find((s) => s.id === sheetId),
      );
      setResult(runResult);
      setRanSheetId(sheetId);
    } finally {
      setRunning(false);
    }
  }

  function goToResult() {
    if (!ranSheetId) return;
    setActiveSheet(ranSheetId);
    setView('editor');
    onClose();
  }

  const canExecute =
    !!parsed &&
    parsed.steps.length > 0 &&
    (target === 'current' || (target === 'otherSheet' ? !!targetSheetId : !!importedFile));

  return (
    <Modal
      title={initialWorkflow ? `Executar workflow: ${initialWorkflow.name}` : 'Importar e executar workflow'}
      onClose={onClose}
      width={480}
    >
      <div className="flex flex-col gap-4">
        {!initialWorkflow && (
          <div>
            <input ref={workflowInputRef} type="file" accept=".json" className="hidden" onChange={handleWorkflowFile} />
            <button
              type="button"
              onClick={() => workflowInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded border border-dashed px-3 py-2 text-[13px]"
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text)' }}
            >
              <FileJson size={16} />
              {parsed ? 'Trocar arquivo de workflow (.json)' : 'Escolher arquivo de workflow (.json)'}
            </button>
            {parseError && <p className="mt-1.5 text-[12px] text-[var(--color-danger)]">{parseError}</p>}
          </div>
        )}

        {parsed && (
          <>
            <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-[13px] font-medium text-[var(--color-text)]">
                {parsed.name} <span className="text-[var(--color-text-subtle)]">· v{parsed.version}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-subtle)]">
                {parsed.steps.length} etapa{parsed.steps.length === 1 ? '' : 's'}
                {parsed.skippedRawSteps.length > 0 &&
                  ` · ${parsed.skippedRawSteps.length} não reconhecida(s) nesta versão`}
              </p>
              <ol className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
                {parsed.steps.map((step, i) => (
                  <li key={step.id} className="flex gap-2 text-[12px]">
                    <span className="shrink-0 text-[var(--color-text-subtle)]">{i + 1}.</span>
                    <span className="shrink-0 rounded-sm bg-[var(--color-accent-soft)] px-1 py-px text-[9px] font-medium text-[var(--color-accent)]">
                      {OPERATION_BADGE[step.type]}
                    </span>
                    <span className="text-[var(--color-text)]">{describeOperation(step)}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="mb-1.5 text-[12px] font-medium text-[var(--color-text-subtle)]">Aplicar em</p>
              <div className="flex gap-1.5">
                {initialWorkflow ? (
                  <button
                    type="button"
                    onClick={() => setTarget('otherSheet')}
                    disabled={otherSheets.length === 0}
                    className="flex-1 truncate rounded border px-2 py-1.5 text-[12px] disabled:opacity-40"
                    style={{
                      borderColor: target === 'otherSheet' ? 'var(--color-accent)' : 'var(--color-border)',
                      color: target === 'otherSheet' ? 'var(--color-accent)' : 'var(--color-text)',
                    }}
                  >
                    Outra aba
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTarget('current')}
                    className="flex-1 truncate rounded border px-2 py-1.5 text-[12px]"
                    style={{
                      borderColor: target === 'current' ? 'var(--color-accent)' : 'var(--color-border)',
                      color: target === 'current' ? 'var(--color-accent)' : 'var(--color-text)',
                    }}
                    title={activeSheet.name}
                  >
                    Aba atual ({activeSheet.name})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTarget('import')}
                  className="flex-1 rounded border px-2 py-1.5 text-[12px]"
                  style={{
                    borderColor: target === 'import' ? 'var(--color-accent)' : 'var(--color-border)',
                    color: target === 'import' ? 'var(--color-accent)' : 'var(--color-text)',
                  }}
                >
                  Nova planilha importada
                </button>
              </div>

              {target === 'otherSheet' && (
                otherSheets.length > 0 ? (
                  <select
                    className="mt-2 w-full rounded border px-2 py-1.5 text-[13px]"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                    value={targetSheetId}
                    onChange={(e) => setTargetSheetId(e.target.value)}
                  >
                    {otherSheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-2 text-[12px] text-[var(--color-text-subtle)]">
                    Não há outra aba neste workbook — importe uma planilha nova.
                  </p>
                )
              )}

              {target === 'import' && (
                <div className="mt-2">
                  <input
                    ref={dataInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={handleDataFile}
                  />
                  <button
                    type="button"
                    onClick={() => dataInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded border border-dashed px-3 py-2 text-[13px]"
                    style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text)' }}
                  >
                    <Upload size={16} />
                    {importedFile ? importedFile.name : 'Escolher planilha de entrada (.xlsx, .csv)'}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void execute()}
              disabled={!canExecute || running}
              className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
              style={{ background: 'var(--color-accent)' }}
            >
              {running ? 'Executando…' : 'Executar workflow'}
            </button>
          </>
        )}

        {result && (
          <div className="rounded border px-3 py-2 text-[12px]" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[var(--color-text)]">
              {result.appliedCount} etapa{result.appliedCount === 1 ? '' : 's'} aplicada
              {result.appliedCount === 1 ? '' : 's'} com sucesso.
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
              onClick={goToResult}
              className="mt-2 rounded border px-2.5 py-1.5 text-[12px]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Ver resultado no Editor
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
