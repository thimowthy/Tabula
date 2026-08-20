import { useState } from 'react';
import type { SheetModel, WorkflowOperation } from '../../model/types';
import type { AppCommand } from '../../commands/types';
import { describeOperation, OPERATION_BADGE } from '../../workflow/describe';
import { previewWorkflowOperation } from '../../workflow/describeCommand';
import { resolveWorkflowStep } from '../../workflow/runWorkflow';
import { FillNullModal } from './FillNullModal';
import { FillConstantModal } from './FillConstantModal';
import { MathOperationModal } from './MathOperationModal';
import { PadStringModal } from './PadStringModal';
import { ChangeCaseModal } from './ChangeCaseModal';
import { ConcatColumnsModal } from './ConcatColumnsModal';
import { ReplaceStepModal } from './ReplaceStepModal';
import { ExtractModal } from './ExtractModal';
import { MapValuesModal } from './MapValuesModal';
import { RoundModal } from './RoundModal';
import { FixDecimalPlacesModal } from './FixDecimalPlacesModal';
import { CastTypeStepModal } from './CastTypeStepModal';
import { TrimWhitespaceModal } from './TrimWhitespaceModal';
import { WhenModal } from './WhenModal';

type CuratedType =
  | 'fillNull'
  | 'fillConstant'
  | 'math'
  | 'pad'
  | 'concat'
  | 'replace'
  | 'extract'
  | 'mapValues'
  | 'round'
  | 'fixDecimals'
  | 'castType'
  | 'trim'
  | 'changeCase'
  | 'when';

const CURATED_OPTIONS: { value: CuratedType; label: string }[] = [
  { value: 'fillNull', label: 'Preencher vazios…' },
  { value: 'fillConstant', label: 'Preencher com valores…' },
  { value: 'math', label: 'Operação matemática…' },
  { value: 'pad', label: 'Preencher tamanho fixo…' },
  { value: 'concat', label: 'Concatenar colunas…' },
  { value: 'replace', label: 'Substituir texto (regex)…' },
  { value: 'extract', label: 'Extrair texto (regex)…' },
  { value: 'mapValues', label: 'Substituir por de-para…' },
  { value: 'round', label: 'Arredondar…' },
  { value: 'fixDecimals', label: 'Fixar casas decimais…' },
  { value: 'castType', label: 'Converter tipo…' },
  { value: 'trim', label: 'Remover espaços…' },
  { value: 'changeCase', label: 'Maiúsculas/minúsculas/capitalizar…' },
  { value: 'when', label: 'Condicional aninhado…' },
];

/** Maps a recorded step's type back to the curated add-menu entry that edits
 * it — the reverse of what each modal produces when applied. The three cast_to_*
 * types share the one 'castType' modal (it distinguishes them via its own
 * `target` field), mirroring how WorkflowPanel's top-level step editor does it. */
const CURATED_TYPE_FOR_OP: Partial<Record<WorkflowOperation['type'], CuratedType>> = {
  fill_null: 'fillNull',
  fill_constant: 'fillConstant',
  math_operation: 'math',
  pad_string: 'pad',
  concat_columns: 'concat',
  replace: 'replace',
  extract: 'extract',
  map_values: 'mapValues',
  round: 'round',
  fix_decimal_places: 'fixDecimals',
  cast_to_integer: 'castType',
  cast_to_float: 'castType',
  cast_to_datetime: 'castType',
  trim_whitespace: 'trim',
  change_case: 'changeCase',
  when: 'when',
};

interface BranchOperationsEditorProps {
  sheet: SheetModel;
  operations: AppCommand[];
  onChange: (next: AppCommand[]) => void;
}

/** Edits the list of operations inside one `when` branch (a case or the
 * default). Operations are composed by opening the SAME modal a standalone
 * "Aplicar" click would use, just in "compose" mode (onApply instead of
 * dispatch) — so there's exactly one form per operation type, reused here
 * and standalone. Editing an already-added operation reopens that same modal
 * pre-filled (initialParams/onSaveDefinition), the same round-trip
 * WorkflowPanel uses to edit a top-level step. Only the curated, per-row
 * value-mutating operations are offered: structural ones (rename/drop/
 * add_column/filter_rows/...) aren't, since they don't have a well-defined
 * per-row meaning and the engine rejects a `when` whose branches disagree on
 * row count or column set. */
export function BranchOperationsEditor({ sheet, operations, onChange }: BranchOperationsEditorProps) {
  const columns = sheet.columns;
  const [openModal, setOpenModal] = useState<CuratedType | null>(null);
  // Tracks the operation object being edited (not its index) so a concurrent
  // add/remove elsewhere in the list — Modal isn't a blocking dialog, the
  // branch list stays interactive while a modal is open — can't make the
  // save land on the wrong row; the index is re-resolved by reference at
  // save time instead of trusted from when the modal opened.
  const [editingOperation, setEditingOperation] = useState<AppCommand | null>(null);

  function addOperation(command: AppCommand) {
    onChange([...operations, command]);
    setOpenModal(null);
  }

  function removeOperation(i: number) {
    onChange(operations.filter((_, idx) => idx !== i));
  }

  function closeModal() {
    setOpenModal(null);
    setEditingOperation(null);
  }

  function editOperation(cmd: AppCommand) {
    const preview = previewWorkflowOperation(cmd, columns);
    const curated = preview ? CURATED_TYPE_FOR_OP[preview.type] : undefined;
    if (!curated) return;
    setEditingOperation(cmd);
    setOpenModal(curated);
  }

  function saveEdited(params: Record<string, unknown>, operationType?: string) {
    if (!editingOperation) return;
    const index = operations.indexOf(editingOperation);
    if (index === -1) {
      closeModal();
      return;
    }
    const preview = previewWorkflowOperation(editingOperation, columns);
    const type = (operationType ?? preview?.type) as WorkflowOperation['type'] | undefined;
    if (!type) return;
    const resolved = resolveWorkflowStep({ id: 'edit', type, params } as WorkflowOperation, sheet);
    if ('command' in resolved) {
      onChange(operations.map((op, idx) => (idx === index ? resolved.command : op)));
    }
    closeModal();
  }

  const editingPreview = editingOperation ? previewWorkflowOperation(editingOperation, columns) : null;
  const castInitialParams =
    editingPreview?.type === 'cast_to_integer'
      ? { target: 'integer' as const, column: editingPreview.params.column }
      : editingPreview?.type === 'cast_to_float'
        ? { target: 'float' as const, column: editingPreview.params.column }
        : editingPreview?.type === 'cast_to_datetime'
          ? { target: 'datetime' as const, column: editingPreview.params.column, format: editingPreview.params.format }
          : undefined;

  return (
    <div className="flex flex-col gap-2">
      {operations.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-subtle)]">Nenhuma operação neste ramo ainda.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {operations.map((cmd, i) => {
            const preview = previewWorkflowOperation(cmd, columns);
            const editable = !!preview && !!CURATED_TYPE_FOR_OP[preview.type];
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded border px-2 py-1"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="shrink-0 rounded-sm bg-[var(--color-accent-soft)] px-1 py-px text-[9px] font-medium text-[var(--color-accent)]">
                  {preview ? OPERATION_BADGE[preview.type] : '?'}
                </span>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => editOperation(cmd)}
                    title="Clique para editar esta operação"
                    className="flex-1 truncate text-left text-[12px] text-[var(--color-text)] hover:text-[var(--color-accent)] hover:underline"
                  >
                    {describeOperation(preview)}
                  </button>
                ) : (
                  <span className="flex-1 text-[12px] text-[var(--color-text)]">
                    {preview ? describeOperation(preview) : 'Operação'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeOperation(i)}
                  className="text-[11px] text-[var(--color-text-subtle)] hover:text-[var(--color-danger)]"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <select
        className="w-fit rounded border px-2 py-1 text-[11px]"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-accent)' }}
        value=""
        onChange={(e) => e.target.value && setOpenModal(e.target.value as CuratedType)}
      >
        <option value="" disabled>
          + adicionar operação…
        </option>
        {CURATED_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {openModal === 'fillNull' && (
        <FillNullModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'fill_null' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'fillConstant' && (
        <FillConstantModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'fill_constant' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'math' && (
        <MathOperationModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'math_operation' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'pad' && (
        <PadStringModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'pad_string' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'concat' && (
        <ConcatColumnsModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'concat_columns' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'replace' && (
        <ReplaceStepModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'replace' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'extract' && (
        <ExtractModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'extract' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'mapValues' && (
        <MapValuesModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'map_values' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'round' && (
        <RoundModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'round' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'fixDecimals' && (
        <FixDecimalPlacesModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'fix_decimal_places' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'castType' && (
        <CastTypeStepModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={castInitialParams}
          onSaveDefinition={editingOperation ? (operationType, params) => saveEdited(params, operationType) : undefined}
        />
      )}
      {openModal === 'trim' && (
        <TrimWhitespaceModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'trim_whitespace' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'changeCase' && (
        <ChangeCaseModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'change_case' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
      {openModal === 'when' && (
        <WhenModal
          onClose={closeModal}
          onApply={editingOperation ? undefined : addOperation}
          initialParams={editingPreview?.type === 'when' ? editingPreview.params : undefined}
          onSaveDefinition={editingOperation ? (params) => saveEdited(params) : undefined}
        />
      )}
    </div>
  );
}
