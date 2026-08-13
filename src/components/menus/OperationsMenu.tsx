import { useState } from 'react';
import {
  Heading,
  Filter,
  Eraser,
  Droplet,
  PaintBucket,
  SquarePlus,
  CopyMinus,
  Hash,
  Split,
  Combine,
  Calculator,
  Sigma,
  Percent,
  AlignLeft,
  CaseSensitive,
  Regex,
  TextSearch,
  Replace,
  GitBranch,
} from 'lucide-react';
import { RibbonGroups, type RibbonGroup } from '../toolbar/RibbonRow';
import { FilterStepModal } from './FilterStepModal';
import { TrimWhitespaceModal } from './TrimWhitespaceModal';
import { FillNullModal } from './FillNullModal';
import { FillConstantModal } from './FillConstantModal';
import { AddColumnModal } from './AddColumnModal';
import { CastTypeStepModal } from './CastTypeStepModal';
import { SplitColumnModal } from './SplitColumnModal';
import { MathOperationModal } from './MathOperationModal';
import { PadStringModal } from './PadStringModal';
import { ChangeCaseModal } from './ChangeCaseModal';
import { ConcatColumnsModal } from './ConcatColumnsModal';
import { ReplaceStepModal } from './ReplaceStepModal';
import { ExtractModal } from './ExtractModal';
import { MapValuesModal } from './MapValuesModal';
import { RoundModal } from './RoundModal';
import { DeduplicateModal } from './DeduplicateModal';
import { PromoteHeaderRowModal } from './PromoteHeaderRowModal';
import { FixDecimalPlacesModal } from './FixDecimalPlacesModal';
import { WhenModal } from './WhenModal';

type OperationModal =
  | 'filterStep'
  | 'trim'
  | 'fillNull'
  | 'fillConstant'
  | 'addColumn'
  | 'dedupe'
  | 'promoteHeader'
  | 'castType'
  | 'split'
  | 'concat'
  | 'math'
  | 'round'
  | 'fixDecimals'
  | 'pad'
  | 'changeCase'
  | 'replace'
  | 'extract'
  | 'mapValues'
  | 'when';

/** Declarative, workflow-recording operations — distinct from Dados, which
 * covers direct spreadsheet editing (sort, view filters, insert/delete). */
export function OperationsMenu() {
  const [modal, setModal] = useState<OperationModal | null>(null);

  const groups: RibbonGroup[] = [
    {
      title: 'Estrutura',
      items: [
        { label: 'Definir linha de cabeçalho…', icon: Heading, onSelect: () => setModal('promoteHeader') },
        { label: 'Filtrar linhas…', icon: Filter, onSelect: () => setModal('filterStep') },
        { label: 'Adicionar coluna…', icon: SquarePlus, onSelect: () => setModal('addColumn') },
        { label: 'Remover linhas duplicadas…', icon: CopyMinus, onSelect: () => setModal('dedupe') },
      ],
    },
    {
      title: 'Preencher',
      items: [
        { label: 'Preencher vazios…', icon: Droplet, onSelect: () => setModal('fillNull') },
        { label: 'Preencher com valores…', icon: PaintBucket, onSelect: () => setModal('fillConstant') },
      ],
    },
    {
      title: 'Texto',
      items: [
        { label: 'Remover espaços…', icon: Eraser, onSelect: () => setModal('trim') },
        { label: 'Preencher tamanho fixo…', icon: AlignLeft, onSelect: () => setModal('pad') },
        { label: 'Maiúsculas/minúsculas/capitalizar…', icon: CaseSensitive, onSelect: () => setModal('changeCase') },
      ],
    },
    {
      title: 'Tipos e cálculo',
      items: [
        { label: 'Converter tipo…', icon: Hash, onSelect: () => setModal('castType') },
        { label: 'Operação matemática…', icon: Calculator, onSelect: () => setModal('math') },
        { label: 'Arredondar…', icon: Sigma, onSelect: () => setModal('round') },
        { label: 'Fixar casas decimais…', icon: Percent, onSelect: () => setModal('fixDecimals') },
      ],
    },
    {
      title: 'Colunas',
      items: [
        { label: 'Dividir coluna…', icon: Split, onSelect: () => setModal('split') },
        { label: 'Concatenar colunas…', icon: Combine, onSelect: () => setModal('concat') },
      ],
    },
    {
      title: 'Regex e de-para',
      items: [
        { label: 'Substituir texto (regex)…', icon: Regex, onSelect: () => setModal('replace') },
        { label: 'Extrair texto (regex)…', icon: TextSearch, onSelect: () => setModal('extract') },
        { label: 'Substituir por de-para…', icon: Replace, onSelect: () => setModal('mapValues') },
      ],
    },
    {
      title: 'Condicional',
      items: [{ label: 'Se / senão…', icon: GitBranch, onSelect: () => setModal('when') }],
    },
  ];

  return (
    <>
      <RibbonGroups groups={groups} />
      {modal === 'promoteHeader' && <PromoteHeaderRowModal onClose={() => setModal(null)} />}
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
      {modal === 'fixDecimals' && <FixDecimalPlacesModal onClose={() => setModal(null)} />}
      {modal === 'pad' && <PadStringModal onClose={() => setModal(null)} />}
      {modal === 'changeCase' && <ChangeCaseModal onClose={() => setModal(null)} />}
      {modal === 'replace' && <ReplaceStepModal onClose={() => setModal(null)} />}
      {modal === 'extract' && <ExtractModal onClose={() => setModal(null)} />}
      {modal === 'mapValues' && <MapValuesModal onClose={() => setModal(null)} />}
      {modal === 'when' && <WhenModal onClose={() => setModal(null)} />}
    </>
  );
}
