import { useState } from 'react';
import { TableProperties } from 'lucide-react';
import { RibbonGroups, type RibbonGroup } from '../toolbar/RibbonRow';
import { ColumnManagerModal } from './ColumnManagerModal';

export function ColumnsMenu() {
  const [open, setOpen] = useState(false);

  const groups: RibbonGroup[] = [
    { title: 'Gerenciar', items: [{ label: 'Gerenciar colunas…', icon: TableProperties, onSelect: () => setOpen(true) }] },
  ];

  return (
    <>
      <RibbonGroups groups={groups} />
      {open && <ColumnManagerModal onClose={() => setOpen(false)} />}
    </>
  );
}
