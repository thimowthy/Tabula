import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';
import { ConditionEditor } from '../ui/ConditionEditor';
import { BranchOperationsEditor } from './BranchOperationsEditor';
import { emptyCondition, idCondition, nameCondition, type ConditionExpr } from '../../model/condition';
import { previewWorkflowOperation } from '../../workflow/describeCommand';
import { resolveWorkflowStep } from '../../workflow/runWorkflow';
import type { AppCommand } from '../../commands/types';
import type { SheetModel, WorkflowOperation } from '../../model/types';

interface WhenCaseDraft {
  condition: ConditionExpr;
  operations: AppCommand[];
}

type WhenParams = Extract<WorkflowOperation, { type: 'when' }>['params'];

/** Best-effort: resolves each recorded (name-keyed) branch operation back
 * into a live (id-keyed) AppCommand for pre-filling the editor. An op whose
 * column no longer exists is dropped rather than blocking the whole edit. */
function resolveOperationsForEdit(operations: WorkflowOperation[], sheet: SheetModel): AppCommand[] {
  const commands: AppCommand[] = [];
  for (const op of operations) {
    const resolved = resolveWorkflowStep(op, sheet);
    if ('command' in resolved) commands.push(resolved.command);
  }
  return commands;
}

interface WhenModalProps {
  onClose: () => void;
  /** When present (composing inside another `when`'s branch), "Aplicar"
   * hands the built APPLY_WHEN command to this instead of dispatching it. */
  onApply?: (command: AppCommand) => void;
  /** Pre-fills the form from an already-recorded `when` step (name-keyed). */
  initialParams?: WhenParams;
  /** When present, "Aplicar" rewrites the recorded step's params in place
   * instead of applying anything — used to edit a step from the workflow panel. */
  onSaveDefinition?: (params: WhenParams) => void;
}

/** Builds a `when` step: one or more cases (condition -> operations), evaluated
 * in order (first match wins), plus an optional "senão" (default) branch for
 * rows matching no case. Each branch's operations reuse the exact same modals
 * as the standalone Operações menu — see BranchOperationsEditor. */
export function WhenModal({ onClose, onApply, initialParams, onSaveDefinition }: WhenModalProps) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const firstColumnId = selectedColumnId ?? sheet.columns[0]?.id ?? '';

  const [cases, setCases] = useState<WhenCaseDraft[]>(() => {
    if (!initialParams) return [{ condition: emptyCondition(firstColumnId), operations: [] }];
    return initialParams.cases.map((c) => ({
      condition: idCondition(c.condition, sheet.columns),
      operations: resolveOperationsForEdit(c.operations, sheet),
    }));
  });
  const [hasDefault, setHasDefault] = useState(initialParams ? initialParams.default !== null : false);
  const [defaultOperations, setDefaultOperations] = useState<AppCommand[]>(() =>
    initialParams?.default ? resolveOperationsForEdit(initialParams.default, sheet) : [],
  );

  function updateCase(i: number, patch: Partial<WhenCaseDraft>) {
    setCases((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addCase() {
    setCases((prev) => [...prev, { condition: emptyCondition(firstColumnId), operations: [] }]);
  }

  function removeCase(i: number) {
    setCases((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveCase(i: number, direction: -1 | 1) {
    setCases((prev) => {
      const target = i + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  }

  const canApply = cases.length > 0 && cases.every((c) => c.operations.length > 0);

  function apply() {
    if (!canApply) return;
    if (onSaveDefinition) {
      onSaveDefinition({
        cases: cases.map((c) => ({
          condition: nameCondition(c.condition, sheet.columns),
          operations: c.operations
            .map((cmd) => previewWorkflowOperation(cmd, sheet.columns))
            .filter((op): op is WorkflowOperation => !!op),
        })),
        default: hasDefault
          ? defaultOperations.map((cmd) => previewWorkflowOperation(cmd, sheet.columns)).filter((op): op is WorkflowOperation => !!op)
          : null,
      });
      onClose();
      return;
    }
    const command: AppCommand = {
      type: 'APPLY_WHEN',
      payload: {
        sheetId: sheet.id,
        cases: cases.map((c) => ({ condition: c.condition, operations: c.operations })),
        default: hasDefault ? defaultOperations : null,
      },
    };
    if (onApply) onApply(command);
    else dispatch(command);
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: condicional (se / senão)" onClose={onClose} width={620}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Aplica operações diferentes por linha, conforme a condição de cada caso — o primeiro caso cuja condição bater
        vence (a ordem dos casos importa; use as setas para reordenar). Linhas que não batem em nenhum caso seguem
        para "senão" (ou ficam como estavam, se não houver "senão"). Cada ramo precisa terminar com a mesma
        quantidade de linhas e as mesmas colunas dos demais.
      </p>
      <div className="flex flex-col gap-4">
        {cases.map((c, i) => (
          <div key={i} className="rounded border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[var(--color-text)]">Caso {i + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveCase(i, -1)}
                  disabled={i === 0}
                  title="Mover caso para cima"
                  className="rounded border px-1.5 text-[12px] leading-5 disabled:opacity-30"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-subtle)' }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveCase(i, 1)}
                  disabled={i === cases.length - 1}
                  title="Mover caso para baixo"
                  className="rounded border px-1.5 text-[12px] leading-5 disabled:opacity-30"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-subtle)' }}
                >
                  ↓
                </button>
                {cases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCase(i)}
                    className="text-[11px] text-[var(--color-text-subtle)] hover:text-[var(--color-danger)]"
                  >
                    remover caso
                  </button>
                )}
              </div>
            </div>
            <div className="mb-3">
              <ConditionEditor columns={sheet.columns} value={c.condition} onChange={(condition) => updateCase(i, { condition })} />
            </div>
            <BranchOperationsEditor
              columns={sheet.columns}
              operations={c.operations}
              onChange={(operations) => updateCase(i, { operations })}
            />
          </div>
        ))}
        <button type="button" onClick={addCase} className="w-fit text-[12px] text-[var(--color-accent)]">
          + adicionar caso (estilo switch)
        </button>

        <div className="rounded border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <label className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--color-text)]">
            <input type="checkbox" checked={hasDefault} onChange={(e) => setHasDefault(e.target.checked)} />
            Senão (linhas que não bateram em nenhum caso)
          </label>
          {hasDefault && (
            <BranchOperationsEditor columns={sheet.columns} operations={defaultOperations} onChange={setDefaultOperations} />
          )}
        </div>

        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          {onSaveDefinition ? 'Salvar alterações' : 'Aplicar e registrar etapa'}
        </button>
      </div>
    </Modal>
  );
}
