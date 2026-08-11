import { useRef, useState } from 'react';
import { useActiveSheet, useWorkbookStore } from '../store/useWorkbookStore';
import { describeOperation, OPERATION_BADGE } from '../workflow/describe';
import { downloadWorkflow } from '../workflow/exportWorkflow';
import type { WorkflowOperation } from '../model/types';
import { FillNullModal } from './menus/FillNullModal';
import { FillConstantModal } from './menus/FillConstantModal';
import { MathOperationModal } from './menus/MathOperationModal';
import { PadStringModal } from './menus/PadStringModal';
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

  function saveStep(stepId: string, params: Record<string, unknown>, operationType?: string) {
    dispatch({ type: 'UPDATE_WORKFLOW_STEP', payload: { sheetId: sheet.id, stepId, params, operationType } });
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
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => setEditingStep(step)}
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
