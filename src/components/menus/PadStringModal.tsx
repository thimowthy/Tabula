import { useState } from 'react';
import { useWorkbookStore } from '../../store/useWorkbookStore';
import { useSelectionActions } from '../../grid/useSelectionActions';
import { Modal } from '../ui/Modal';

export function PadStringModal({ onClose }: { onClose: () => void }) {
  const { sheet, selectedColumnId } = useSelectionActions();
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const [columnId, setColumnId] = useState(selectedColumnId ?? sheet.columns[0]?.id ?? '');
  const [length, setLength] = useState(5);
  const [padChar, setPadChar] = useState('0');
  const [side, setSide] = useState<'left' | 'right'>('left');

  function apply() {
    dispatch({
      type: 'PAD_STRING',
      payload: { sheetId: sheet.id, columnId, length, padChar: padChar || '0', side },
    });
    onClose();
  }

  return (
    <Modal title="Etapa do workflow: preencher tamanho fixo" onClose={onClose} width={380}>
      <p className="mb-3 text-[12px] text-[var(--color-text-subtle)]">
        Completa o texto até o tamanho informado repetindo o caractere de preenchimento. Útil para CEP, CPF e
        outros códigos de largura fixa. A coluna vira texto (evita perder zeros à esquerda).
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Coluna
          <select
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
          >
            {sheet.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Tamanho
            <input
              type="number"
              min={1}
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={length}
              onChange={(e) => setLength(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label className="flex w-20 flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
            Caractere
            <input
              maxLength={1}
              className="rounded border px-2 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              value={padChar}
              onChange={(e) => setPadChar(e.target.value.slice(0, 1))}
            />
          </label>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSide('left')}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: side === 'left' ? 'var(--color-accent)' : 'var(--color-border)',
              color: side === 'left' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            À esquerda
          </button>
          <button
            type="button"
            onClick={() => setSide('right')}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: side === 'right' ? 'var(--color-accent)' : 'var(--color-border)',
              color: side === 'right' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            À direita
          </button>
        </div>
        <button
          type="button"
          onClick={apply}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white"
          style={{ background: 'var(--color-accent)' }}
        >
          Aplicar e registrar etapa
        </button>
      </div>
    </Modal>
  );
}
