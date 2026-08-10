import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { runWorkflowSteps, type RunResult } from '../../workflow/runWorkflow';
import { describeOperation } from '../../workflow/describe';
import { importWorkbookFile, exportSheetToCsv, exportSheetToXlsx } from '../../io/xlsxIO';
import { Modal } from '../ui/Modal';
import type { ServerWorkflow } from '../../api/workflowsApi';

type OutputFormat = 'xlsx' | 'csv';

/** The one-click "Importar planilha" path from the Workflows screen: pick a
 * file, run the workflow's steps on it, and download the result — with the
 * output name and format chosen here rather than hardcoded, since a .csv
 * consumer downstream and an .xlsx one aren't interchangeable. */
export function ImportAndRunModal({ workflow, onClose }: { workflow: ServerWorkflow; onClose: () => void }) {
  const setActiveSheet = useWorkbookStore((s) => s.setActiveSheet);
  const setView = useWorkbookStore((s) => s.setView);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState(`${workflow.name}-resultado`);
  const [format, setFormat] = useState<OutputFormat>('xlsx');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [ranSheetId, setRanSheetId] = useState<string | null>(null);

  async function run() {
    if (!file || running) return;
    setRunning(true);
    setResult(null);
    try {
      const imported = await importWorkbookFile(file);
      const sheetId = imported.sheets[0].id;
      const { dispatch } = useWorkbookStore.getState();
      dispatch({ type: 'IMPORT_SHEETS', payload: { sheets: imported.sheets } });

      const runResult = runWorkflowSteps(workflow.steps, dispatch, () =>
        useWorkbookStore.getState().workbook.sheets.find((s) => s.id === sheetId),
      );
      const resultSheet = useWorkbookStore.getState().workbook.sheets.find((s) => s.id === sheetId);
      const finalName = filename.trim() || `${workflow.name}-resultado`;
      if (resultSheet) {
        if (format === 'xlsx') exportSheetToXlsx(resultSheet, finalName);
        else exportSheetToCsv(resultSheet, finalName);
      }
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

  return (
    <Modal title={`Importar planilha: ${workflow.name}`} onClose={onClose} width={420}>
      <div className="flex flex-col gap-3">
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

        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Nome do arquivo de saída
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={`${workflow.name}-resultado`}
          />
        </label>

        <div>
          <p className="mb-1.5 text-[12px] font-medium text-[var(--color-text-subtle)]">Formato de saída</p>
          <div className="flex gap-1.5">
            {(['xlsx', 'csv'] as OutputFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className="flex-1 rounded border px-2 py-1.5 text-[12px]"
                style={{
                  borderColor: format === f ? 'var(--color-accent)' : 'var(--color-border)',
                  color: format === f ? 'var(--color-accent)' : 'var(--color-text)',
                }}
              >
                .{f}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void run()}
          disabled={!file || running}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          {running ? 'Executando…' : 'Executar e baixar'}
        </button>

        {result && (
          <div className="rounded border px-3 py-2 text-[12px]" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[var(--color-text)]">
              {result.appliedCount} etapa{result.appliedCount === 1 ? '' : 's'} aplicada
              {result.appliedCount === 1 ? '' : 's'} com sucesso — resultado baixado (.{format}).
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
