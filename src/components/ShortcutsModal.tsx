import { Modal } from './ui/Modal';

interface ShortcutGroup {
  title: string;
  items: { keys: string; description: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navegação e seleção',
    items: [
      { keys: 'Setas / Tab / Enter', description: 'Mover a célula ativa' },
      { keys: 'Shift + seta', description: 'Estender a seleção' },
      { keys: 'Shift + clique', description: 'Estender a seleção até a célula clicada' },
      { keys: 'Clique e arraste', description: 'Selecionar um intervalo' },
      { keys: 'Clique no cabeçalho / número da linha', description: 'Selecionar a coluna / linha inteira' },
    ],
  },
  {
    title: 'Edição',
    items: [
      { keys: 'Digitar', description: 'Substituir o conteúdo da célula ativa' },
      { keys: 'Enter', description: 'Confirmar edição' },
      { keys: 'Esc', description: 'Cancelar edição' },
      { keys: 'Delete / Backspace', description: 'Limpar conteúdo da seleção' },
      { keys: 'Ctrl + C / Ctrl + V', description: 'Copiar / colar' },
    ],
  },
  {
    title: 'Linhas e colunas selecionadas',
    items: [
      { keys: 'Ctrl + Shift + "+"', description: 'Inserir linha (ou coluna, se a seleção for de coluna inteira)' },
      { keys: 'Ctrl + Shift + "-"', description: 'Excluir linha (ou coluna, se a seleção for de coluna inteira)' },
      { keys: 'Botão direito', description: 'Abrir o menu de contexto com essas e outras ações' },
    ],
  },
  {
    title: 'Formatação',
    items: [
      { keys: 'Ctrl + B', description: 'Negrito' },
      { keys: 'Ctrl + I', description: 'Itálico' },
    ],
  },
  {
    title: 'Histórico e ajuda',
    items: [
      { keys: 'Ctrl + Z', description: 'Desfazer' },
      { keys: 'Ctrl + Shift + Z / Ctrl + Y', description: 'Refazer' },
      { keys: '?', description: 'Abrir esta janela' },
    ],
  },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Atalhos de teclado" onClose={onClose} width={480}>
      <div className="flex flex-col gap-4">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--color-text-subtle)] uppercase">
              {group.title}
            </h3>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <div key={item.keys} className="flex items-center justify-between gap-4 text-[12px]">
                  <span className="text-[var(--color-text)]">{item.description}</span>
                  <kbd
                    className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] whitespace-nowrap"
                    style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface)', color: 'var(--color-text-subtle)' }}
                  >
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
