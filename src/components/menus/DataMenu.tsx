import { useState } from 'react';
import { Table2 } from 'lucide-react';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { DropdownMenu } from '../ui/DropdownMenu';
import { SortModal } from './SortModal';
import { FilterModal } from './FilterModal';
import { FindReplaceModal } from './FindReplaceModal';

type DataModal = 'sort' | 'filter' | 'find';

export function DataMenu() {
  const { hasSelection, insertRows, deleteRows, insertColumns, deleteColumns } = useSelectionActions();
  const [modal, setModal] = useState<DataModal | null>(null);

  return (
    <>
      <DropdownMenu
        trigger={
          <span className="flex items-center gap-1.5">
            <Table2 size={16} />
            <span>Dados</span>
          </span>
        }
        items={[
          { label: 'Ordenar…', onSelect: () => setModal('sort') },
          { label: 'Filtro de visualização…', onSelect: () => setModal('filter') },
          { label: 'Localizar e substituir…', onSelect: () => setModal('find') },
          { label: '', separator: true },
          { label: 'Inserir linha acima', onSelect: () => insertRows('above'), disabled: !hasSelection },
          { label: 'Inserir linha abaixo', onSelect: () => insertRows('below'), disabled: !hasSelection },
          { label: 'Excluir linha(s) selecionada(s)', onSelect: deleteRows, disabled: !hasSelection, danger: true },
          { label: '', separator: true },
          { label: 'Inserir coluna à esquerda', onSelect: () => insertColumns('left'), disabled: !hasSelection },
          { label: 'Inserir coluna à direita', onSelect: () => insertColumns('right'), disabled: !hasSelection },
          { label: 'Excluir coluna(s) selecionada(s)', onSelect: deleteColumns, disabled: !hasSelection, danger: true },
        ]}
      />
      {modal === 'sort' && <SortModal onClose={() => setModal(null)} />}
      {modal === 'filter' && <FilterModal onClose={() => setModal(null)} />}
      {modal === 'find' && <FindReplaceModal onClose={() => setModal(null)} />}
    </>
  );
}
