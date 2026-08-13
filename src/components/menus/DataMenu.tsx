import { useState } from 'react';
import { ArrowUpDown, ListFilter, Search, Rows3, Rows4, Trash2, Columns3, Columns4 } from 'lucide-react';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { RibbonGroups, type RibbonGroup } from '../toolbar/RibbonRow';
import { SortModal } from './SortModal';
import { FilterModal } from './FilterModal';
import { FindReplaceModal } from './FindReplaceModal';

type DataModal = 'sort' | 'filter' | 'find';

export function DataMenu() {
  const { hasSelection, insertRows, deleteRows, insertColumns, deleteColumns } = useSelectionActions();
  const [modal, setModal] = useState<DataModal | null>(null);

  const groups: RibbonGroup[] = [
    {
      title: 'Consultar',
      items: [
        { label: 'Ordenar…', icon: ArrowUpDown, onSelect: () => setModal('sort') },
        { label: 'Filtro de visualização…', icon: ListFilter, onSelect: () => setModal('filter') },
        { label: 'Localizar e substituir…', icon: Search, onSelect: () => setModal('find') },
      ],
    },
    {
      title: 'Linhas',
      items: [
        { label: 'Inserir acima', icon: Rows3, onSelect: () => insertRows('above'), disabled: !hasSelection },
        { label: 'Inserir abaixo', icon: Rows4, onSelect: () => insertRows('below'), disabled: !hasSelection },
        { label: 'Excluir', icon: Trash2, onSelect: deleteRows, disabled: !hasSelection, danger: true },
      ],
    },
    {
      title: 'Colunas',
      items: [
        { label: 'Inserir à esquerda', icon: Columns3, onSelect: () => insertColumns('left'), disabled: !hasSelection },
        { label: 'Inserir à direita', icon: Columns4, onSelect: () => insertColumns('right'), disabled: !hasSelection },
        { label: 'Excluir', icon: Trash2, onSelect: deleteColumns, disabled: !hasSelection, danger: true },
      ],
    },
  ];

  return (
    <>
      <RibbonGroups groups={groups} />
      {modal === 'sort' && <SortModal onClose={() => setModal(null)} />}
      {modal === 'filter' && <FilterModal onClose={() => setModal(null)} />}
      {modal === 'find' && <FindReplaceModal onClose={() => setModal(null)} />}
    </>
  );
}
