import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { DropdownMenu } from '../ui/DropdownMenu';
import { FilterStepModal } from './FilterStepModal';
import { TrimWhitespaceModal } from './TrimWhitespaceModal';
import { FillNullModal } from './FillNullModal';
import { FillConstantModal } from './FillConstantModal';
import { AddColumnModal } from './AddColumnModal';
import { CastTypeStepModal } from './CastTypeStepModal';
import { SplitColumnModal } from './SplitColumnModal';
import { MathOperationModal } from './MathOperationModal';
import { PadStringModal } from './PadStringModal';
import { ConcatColumnsModal } from './ConcatColumnsModal';
import { ReplaceStepModal } from './ReplaceStepModal';
import { ExtractModal } from './ExtractModal';
import { MapValuesModal } from './MapValuesModal';
import { RoundModal } from './RoundModal';
import { DeduplicateModal } from './DeduplicateModal';

type OperationModal =
  | 'filterStep'
  | 'trim'
  | 'fillNull'
  | 'fillConstant'
  | 'addColumn'
  | 'dedupe'
  | 'castType'
  | 'split'
  | 'concat'
  | 'math'
  | 'round'
  | 'pad'
  | 'replace'
  | 'extract'
  | 'mapValues';

/** Declarative, workflow-recording operations — distinct from Dados, which
 * covers direct spreadsheet editing (sort, view filters, insert/delete). */
export function OperationsMenu() {
  const [modal, setModal] = useState<OperationModal | null>(null);

  return (
    <>
      <DropdownMenu
        trigger={
          <span className="flex items-center gap-1.5">
            <Wand2 size={16} />
            <span>Operações</span>
          </span>
        }
        items={[
          { label: 'Filtrar linhas…', onSelect: () => setModal('filterStep') },
          { label: 'Remover espaços…', onSelect: () => setModal('trim') },
          { label: 'Preencher vazios…', onSelect: () => setModal('fillNull') },
          { label: 'Preencher com constante…', onSelect: () => setModal('fillConstant') },
          { label: 'Adicionar coluna…', onSelect: () => setModal('addColumn') },
          { label: 'Remover linhas duplicadas…', onSelect: () => setModal('dedupe') },
          { label: '', separator: true },
          { label: 'Converter tipo (inteiro/decimal/data e hora)…', onSelect: () => setModal('castType') },
          { label: 'Dividir coluna…', onSelect: () => setModal('split') },
          { label: 'Concatenar colunas…', onSelect: () => setModal('concat') },
          { label: 'Operação matemática…', onSelect: () => setModal('math') },
          { label: 'Arredondar…', onSelect: () => setModal('round') },
          { label: 'Preencher tamanho fixo…', onSelect: () => setModal('pad') },
          { label: '', separator: true },
          { label: 'Substituir texto (regex)…', onSelect: () => setModal('replace') },
          { label: 'Extrair texto (regex)…', onSelect: () => setModal('extract') },
          { label: 'Substituir por de-para…', onSelect: () => setModal('mapValues') },
        ]}
      />
      {modal === 'filterStep' && <FilterStepModal onClose={() => setModal(null)} />}
      {modal === 'trim' && <TrimWhitespaceModal onClose={() => setModal(null)} />}
      {modal === 'fillNull' && <FillNullModal onClose={() => setModal(null)} />}
      {modal === 'fillConstant' && <FillConstantModal onClose={() => setModal(null)} />}
      {modal === 'addColumn' && <AddColumnModal onClose={() => setModal(null)} />}
      {modal === 'dedupe' && <DeduplicateModal onClose={() => setModal(null)} />}
      {modal === 'castType' && <CastTypeStepModal onClose={() => setModal(null)} />}
      {modal === 'split' && <SplitColumnModal onClose={() => setModal(null)} />}
      {modal === 'concat' && <ConcatColumnsModal onClose={() => setModal(null)} />}
      {modal === 'math' && <MathOperationModal onClose={() => setModal(null)} />}
      {modal === 'round' && <RoundModal onClose={() => setModal(null)} />}
      {modal === 'pad' && <PadStringModal onClose={() => setModal(null)} />}
      {modal === 'replace' && <ReplaceStepModal onClose={() => setModal(null)} />}
      {modal === 'extract' && <ExtractModal onClose={() => setModal(null)} />}
      {modal === 'mapValues' && <MapValuesModal onClose={() => setModal(null)} />}
    </>
  );
}
