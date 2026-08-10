import { ContextMenu, type MenuItem } from '../components/ui/DropdownMenu';
import { useSelectionActions } from './useSelectionActions';

export type ContextMenuKind = 'cell' | 'row' | 'column';

interface GridContextMenuProps {
  x: number;
  y: number;
  kind: ContextMenuKind;
  onClose: () => void;
}

export function GridContextMenu({ x, y, kind, onClose }: GridContextMenuProps) {
  const { copySelection, pasteSelection, clearSelection, insertRows, deleteRows, insertColumns, deleteColumns } =
    useSelectionActions();

  function run(action: () => void) {
    action();
    onClose();
  }

  const items: MenuItem[] = [
    { label: 'Copiar', onSelect: () => run(() => void copySelection()) },
    { label: 'Colar', onSelect: () => run(() => void pasteSelection()) },
    { label: 'Limpar conteúdo', onSelect: () => run(clearSelection) },
  ];

  if (kind === 'row' || kind === 'cell') {
    items.push(
      { label: '', separator: true },
      { label: 'Inserir linha acima', onSelect: () => run(() => insertRows('above')) },
      { label: 'Inserir linha abaixo', onSelect: () => run(() => insertRows('below')) },
      { label: 'Excluir linha(s)', onSelect: () => run(deleteRows), danger: true },
    );
  }

  if (kind === 'column' || kind === 'cell') {
    items.push(
      { label: '', separator: true },
      { label: 'Inserir coluna à esquerda', onSelect: () => run(() => insertColumns('left')) },
      { label: 'Inserir coluna à direita', onSelect: () => run(() => insertColumns('right')) },
      { label: 'Excluir coluna(s)', onSelect: () => run(deleteColumns), danger: true },
    );
  }

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
}
