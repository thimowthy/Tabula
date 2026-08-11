import { useState } from 'react';
import type { ColumnDef } from '../../model/types';
import type { AppCommand } from '../../commands/types';
import { describeOperation, OPERATION_BADGE } from '../../workflow/describe';
import { previewWorkflowOperation } from '../../workflow/describeCommand';
import { FillNullModal } from './FillNullModal';
import { FillConstantModal } from './FillConstantModal';
import { MathOperationModal } from './MathOperationModal';
import { PadStringModal } from './PadStringModal';
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
  | 'when';

const CURATED_OPTIONS: { value: CuratedType; label: string }[] = [
  { value: 'fillNull', label: 'Preencher vazios…' },
  { value: 'fillConstant', label: 'Preencher com constante…' },
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
  { value: 'when', label: 'Condicional aninhado…' },
];

interface BranchOperationsEditorProps {
  columns: ColumnDef[];
  operations: AppCommand[];
  onChange: (next: AppCommand[]) => void;
}

/** Edits the list of operations inside one `when` branch (a case or the
 * default). Operations are composed by opening the SAME modal a standalone
 * "Aplicar" click would use, just in "compose" mode (onApply instead of
 * dispatch) — so there's exactly one form per operation type, reused here
 * and standalone. Only the curated, per-row value-mutating operations are
 * offered: structural ones (rename/drop/add_column/filter_rows/...) aren't,
 * since they don't have a well-defined per-row meaning and the engine
 * rejects a `when` whose branches disagree on row count or column set. */
export function BranchOperationsEditor({ columns, operations, onChange }: BranchOperationsEditorProps) {
  const [openModal, setOpenModal] = useState<CuratedType | null>(null);

  function addOperation(command: AppCommand) {
    onChange([...operations, command]);
    setOpenModal(null);
  }

  function removeOperation(i: number) {
    onChange(operations.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      {operations.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-subtle)]">Nenhuma operação neste ramo ainda.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {operations.map((cmd, i) => {
            const preview = previewWorkflowOperation(cmd, columns);
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded border px-2 py-1"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="shrink-0 rounded-sm bg-[var(--color-accent-soft)] px-1 py-px text-[9px] font-medium text-[var(--color-accent)]">
                  {preview ? OPERATION_BADGE[preview.type] : '?'}
                </span>
                <span className="flex-1 text-[12px] text-[var(--color-text)]">
                  {preview ? describeOperation(preview) : 'Operação'}
                </span>
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

      {openModal === 'fillNull' && <FillNullModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'fillConstant' && <FillConstantModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'math' && <MathOperationModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'pad' && <PadStringModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'concat' && <ConcatColumnsModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'replace' && <ReplaceStepModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'extract' && <ExtractModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'mapValues' && <MapValuesModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'round' && <RoundModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'fixDecimals' && <FixDecimalPlacesModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'castType' && <CastTypeStepModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'trim' && <TrimWhitespaceModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
      {openModal === 'when' && <WhenModal onClose={() => setOpenModal(null)} onApply={addOperation} />}
    </div>
  );
}
