import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import { useActiveSheet, useWorkbookStore } from '../store/useWorkbookStore';
import { describeOperation, OPERATION_BADGE } from '../workflow/describe';
import { downloadWorkflow } from '../workflow/exportWorkflow';
import { withCurrentColumnNames, withHistoricalColumnNames } from '../workflow/stepColumnHistory';
import type { WorkflowOperation } from '../model/types';
import { FillNullModal } from './menus/FillNullModal';
import { FillConstantModal } from './menus/FillConstantModal';
import { MathOperationModal } from './menus/MathOperationModal';
import { PadStringModal } from './menus/PadStringModal';
import { ChangeCaseModal } from './menus/ChangeCaseModal';
import { ConcatColumnsModal } from './menus/ConcatColumnsModal';
import { ReplaceStepModal } from './menus/ReplaceStepModal';
import { ExtractModal } from './menus/ExtractModal';
import { MapValuesModal } from './menus/MapValuesModal';
import { RoundModal } from './menus/RoundModal';
import { FixDecimalPlacesModal } from './menus/FixDecimalPlacesModal';
import { TrimWhitespaceModal } from './menus/TrimWhitespaceModal';
import { SplitColumnModal } from './menus/SplitColumnModal';
import { DeduplicateModal } from './menus/DeduplicateModal';
import { AddColumnModal } from './menus/AddColumnModal';
import { FilterStepModal } from './menus/FilterStepModal';
import { WhenModal } from './menus/WhenModal';
import { CastTypeStepModal } from './menus/CastTypeStepModal';

const MIN_WIDTH = 220;
const MAX_WIDTH = 640;

/** Step types with a popup that can pre-fill from an existing step's params —
 * these are the ones the panel makes clickable. The rest (rename_column,
 * cast_column_type, drop_columns, reorder_column, promote_header_row) are
 * done via direct grid/header interactions with no standalone form to reopen,
 * so they stay non-interactive here. */
const EDITABLE_TYPES = new Set<WorkflowOperation['type']>([
  'fill_null',
  'fill_constant',
  'math_operation',
  'pad_string',
  'concat_columns',
  'replace',
  'extract',
  'map_values',
  'round',
  'fix_decimal_places',
  'trim_whitespace',
  'cast_to_integer',
  'cast_to_float',
  'cast_to_datetime',
  'split_column',
  'change_case',
  'deduplicate',
  'add_column',
  'filter_rows',
  'when',
]);

export function WorkflowPanel() {
  const sheet = useActiveSheet();
  const documentName = useWorkbookStore((s) => s.documentName);
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [width, setWidth] = useState(320);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [editingStep, setEditingStep] = useState<WorkflowOperation | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ stepId: string; edge: 'top' | 'bottom' } | null>(null);

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    function onMove(ev: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const next = drag.startWidth - (ev.clientX - drag.startX);
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const steps = sheet.workflowSteps;
    const step = steps[index];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    // Moving up: reinsert right before the step currently above it. Moving
    // down: reinsert right before whatever comes after the step currently
    // below it (or at the end, if that step is last) — either way this swaps
    // the two adjacent steps.
    const beforeStepId = direction === 'up' ? steps[targetIndex].id : (steps[targetIndex + 1]?.id ?? null);
    dispatch({ type: 'REORDER_WORKFLOW_STEP', payload: { sheetId: sheet.id, stepId: step.id, beforeStepId } });
  }

  function resetDrag() {
    setDraggedStepId(null);
    setDropTarget(null);
  }

  function handleDragOver(e: React.DragEvent<HTMLLIElement>, stepId: string) {
    if (!draggedStepId || stepId === draggedStepId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const edge = e.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom';
    setDropTarget((prev) => (prev?.stepId === stepId && prev.edge === edge ? prev : { stepId, edge }));
  }

  function handleDrop(e: React.DragEvent<HTMLLIElement>) {
    e.preventDefault();
    if (draggedStepId && dropTarget && dropTarget.stepId !== draggedStepId) {
      const steps = sheet.workflowSteps;
      const overIndex = steps.findIndex((s) => s.id === dropTarget.stepId);
      const beforeStepId = dropTarget.edge === 'top' ? dropTarget.stepId : (steps[overIndex + 1]?.id ?? null);
      dispatch({ type: 'REORDER_WORKFLOW_STEP', payload: { sheetId: sheet.id, stepId: draggedStepId, beforeStepId } });
    }
    resetDrag();
  }

  function deleteStep(stepId: string) {
    dispatch({ type: 'DELETE_WORKFLOW_STEP', payload: { sheetId: sheet.id, stepId } });
    if (editingStep?.id === stepId) setEditingStep(null);
  }

  function saveStep(stepId: string, params: Record<string, unknown>, operationType?: string) {
    // Resolved fresh (rather than captured when the modal opened) in case
    // steps were reordered or deleted while it was open — the panel isn't a
    // blocking dialog, the sheet behind it stays interactive.
    const index = sheet.workflowSteps.findIndex((s) => s.id === stepId);
    if (index === -1) {
      setEditingStep(null);
      return;
    }
    // Modals resolve/produce column names against the sheet's current, fully
    // replayed state (see stepColumnHistory.ts) — translate back to the name
    // that was valid at this step's position before writing it into
    // workflowSteps, so later renames don't corrupt an earlier step.
    const edited = { id: stepId, type: (operationType ?? editingStep?.type) as WorkflowOperation['type'], params } as WorkflowOperation;
    const historical = withHistoricalColumnNames(sheet.workflowSteps, index, edited);
    dispatch({
      type: 'UPDATE_WORKFLOW_STEP',
      payload: { sheetId: sheet.id, stepId, params: historical.params, operationType: historical.type },
    });
    setEditingStep(null);
  }

  function renderEditModal() {
    if (!editingStep) return null;
    const step = editingStep;
    const close = () => setEditingStep(null);
    switch (step.type) {
      case 'fill_null':
        return <FillNullModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />;
      case 'fill_constant':
        return (
          <FillConstantModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'math_operation':
        return (
          <MathOperationModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'pad_string':
        return <PadStringModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />;
      case 'concat_columns':
        return (
          <ConcatColumnsModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'replace':
        return (
          <ReplaceStepModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'extract':
        return <ExtractModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />;
      case 'map_values':
        return <MapValuesModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />;
      case 'round':
        return <RoundModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />;
      case 'fix_decimal_places':
        return (
          <FixDecimalPlacesModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'trim_whitespace':
        return (
          <TrimWhitespaceModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'split_column':
        return (
          <SplitColumnModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'change_case':
        return (
          <ChangeCaseModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'deduplicate':
        return (
          <DeduplicateModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'add_column':
        return <AddColumnModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />;
      case 'filter_rows':
        return (
          <FilterStepModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />
        );
      case 'when':
        return <WhenModal onClose={close} initialParams={step.params} onSaveDefinition={(params) => saveStep(step.id, params)} />;
      case 'cast_to_integer':
        return (
          <CastTypeStepModal
            onClose={close}
            initialParams={{ target: 'integer', column: step.params.column }}
            onSaveDefinition={(operationType, params) => saveStep(step.id, params, operationType)}
          />
        );
      case 'cast_to_float':
        return (
          <CastTypeStepModal
            onClose={close}
            initialParams={{ target: 'float', column: step.params.column }}
            onSaveDefinition={(operationType, params) => saveStep(step.id, params, operationType)}
          />
        );
      case 'cast_to_datetime':
        return (
          <CastTypeStepModal
            onClose={close}
            initialParams={{ target: 'datetime', column: step.params.column, format: step.params.format }}
            onSaveDefinition={(operationType, params) => saveStep(step.id, params, operationType)}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="relative flex shrink-0 flex-col border-l"
      style={{ width, borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="absolute top-0 bottom-0 -left-1 z-10 w-2 cursor-col-resize"
        onMouseDown={onResizeStart}
        title="Arraste para redimensionar"
      />
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
            {sheet.workflowSteps.map((step, i) => {
              const editable = EDITABLE_TYPES.has(step.type);
              const isDragging = draggedStepId === step.id;
              const showDropEdge = dropTarget?.stepId === step.id ? dropTarget.edge : null;
              return (
                <li
                  key={step.id}
                  className="flex items-stretch gap-1"
                  style={{
                    opacity: isDragging ? 0.4 : 1,
                    boxShadow:
                      showDropEdge === 'top'
                        ? 'inset 0 2px 0 0 var(--color-accent)'
                        : showDropEdge === 'bottom'
                          ? 'inset 0 -2px 0 0 var(--color-accent)'
                          : undefined,
                  }}
                  onDragOver={(e) => handleDragOver(e, step.id)}
                  onDrop={handleDrop}
                >
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedStepId(step.id);
                    }}
                    onDragEnd={resetDrag}
                    title="Arraste para reordenar"
                    aria-label="Arraste para reordenar"
                    className="flex shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
                    style={{ color: 'var(--color-text-subtle)' }}
                  >
                    <GripVertical size={14} strokeWidth={2} />
                  </span>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => setEditingStep(withCurrentColumnNames(sheet.workflowSteps, i))}
                    title={editable ? 'Clique para editar esta etapa' : undefined}
                    className="flex w-full gap-2 rounded border px-2 py-1.5 text-left disabled:cursor-default"
                    style={{ borderColor: 'var(--color-border)' }}
                    onMouseEnter={(e) => {
                      if (editable) e.currentTarget.style.borderColor = 'var(--color-accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    <span className="mt-px shrink-0 text-[10px] font-semibold text-[var(--color-text-subtle)]">{i + 1}</span>
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="w-fit rounded-sm bg-[var(--color-accent-soft)] px-1 py-px text-[9px] font-medium text-[var(--color-accent)]">
                        {OPERATION_BADGE[step.type]}
                      </span>
                      <span className="text-[12px] text-[var(--color-text)]">{describeOperation(step)}</span>
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col justify-center gap-px">
                    <button
                      type="button"
                      onClick={() => moveStep(i, 'up')}
                      disabled={i === 0}
                      title="Mover etapa para cima"
                      aria-label="Mover etapa para cima"
                      className="flex h-4 w-4 items-center justify-center rounded-sm hover:bg-[var(--color-surface-hover)] disabled:opacity-25 disabled:hover:bg-transparent"
                      style={{ color: 'var(--color-text-subtle)' }}
                    >
                      <ChevronUp size={12} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(i, 'down')}
                      disabled={i === sheet.workflowSteps.length - 1}
                      title="Mover etapa para baixo"
                      aria-label="Mover etapa para baixo"
                      className="flex h-4 w-4 items-center justify-center rounded-sm hover:bg-[var(--color-surface-hover)] disabled:opacity-25 disabled:hover:bg-transparent"
                      style={{ color: 'var(--color-text-subtle)' }}
                    >
                      <ChevronDown size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteStep(step.id)}
                    title="Excluir etapa"
                    aria-label="Excluir etapa"
                    className="flex shrink-0 items-center rounded-sm px-0.5 hover:bg-[var(--color-surface-hover)]"
                    style={{ color: 'var(--color-text-subtle)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-danger)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-subtle)';
                    }}
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </li>
              );
            })}
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

      {renderEditModal()}
    </div>
  );
}
