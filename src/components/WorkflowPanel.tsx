import { useActiveSheet, useWorkbookStore } from '../store/useWorkbookStore';
import { describeOperation, OPERATION_BADGE } from '../workflow/describe';
import { downloadWorkflow } from '../workflow/exportWorkflow';

export function WorkflowPanel() {
  const sheet = useActiveSheet();
  const documentName = useWorkbookStore((s) => s.documentName);

  return (
    <div
      className="flex w-80 shrink-0 flex-col border-l"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="border-b px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="text-[13px] font-semibold text-[var(--color-text)]">Workflow — {sheet.name}</h2>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-subtle)]">
          {sheet.workflowSteps.length} etapa{sheet.workflowSteps.length === 1 ? '' : 's'} registrada
          {sheet.workflowSteps.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {sheet.workflowSteps.length === 0 ? (
          <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-text-subtle)]">
            Nenhuma operação registrada ainda. Inserir, renomear, mover, alterar tipo e excluir coluna já geram
            etapas automaticamente. Use o menu <strong>Operações</strong> para registrar filtrar linhas, remover
            espaços e preencher vazios.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {sheet.workflowSteps.map((step, i) => (
              <li
                key={step.id}
                className="flex gap-2 rounded border px-2 py-1.5"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="mt-px shrink-0 text-[10px] font-semibold text-[var(--color-text-subtle)]">
                  {i + 1}
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <span className="w-fit rounded-sm bg-[var(--color-accent-soft)] px-1 py-px text-[9px] font-medium text-[var(--color-accent)]">
                    {OPERATION_BADGE[step.type]}
                  </span>
                  <span className="text-[12px] text-[var(--color-text)]">{describeOperation(step)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-t px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={() => downloadWorkflow(sheet, `${documentName}-${sheet.name}-workflow`)}
          disabled={sheet.workflowSteps.length === 0}
          className="w-full rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          Salvar workflow (.json)
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
          Para validar a formatação resultante da planilha, use Arquivo → Exportar.
        </p>
      </div>
    </div>
  );
}
