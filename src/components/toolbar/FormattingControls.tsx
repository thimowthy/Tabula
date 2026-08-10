import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Baseline, Bold, Hash, Italic, PaintBucket } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';
import { useSelectionStyle } from './useSelectionStyle';
import type { Alignment, NumberFormatKind } from '../../model/types';

const FORMAT_LABELS: Record<NumberFormatKind, string> = {
  none: 'Nenhum',
  currency: 'Moeda',
  percent: 'Porcentagem',
  decimal: 'Decimal',
};

export function FormattingControls() {
  const { disabled, current, currentFormat, applyStyle, applyNumberFormat } = useSelectionStyle();
  const [numberMenuOpen, setNumberMenuOpen] = useState(false);
  const numberMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!numberMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (numberMenuRef.current && !numberMenuRef.current.contains(e.target as Node)) setNumberMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [numberMenuOpen]);

  return (
    <div className="flex items-center gap-0.5">
      <ToolbarButton
        icon={Bold}
        label="Negrito"
        active={!!current.bold}
        disabled={disabled}
        onClick={() => applyStyle({ bold: !current.bold })}
      />
      <ToolbarButton
        icon={Italic}
        label="Itálico"
        active={!!current.italic}
        disabled={disabled}
        onClick={() => applyStyle({ italic: !current.italic })}
      />

      <label
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-[var(--color-surface-hover)]"
        style={{ opacity: disabled ? 0.3 : 1, pointerEvents: disabled ? 'none' : undefined }}
        title="Cor do texto"
      >
        <Baseline size={16} style={{ color: current.color ?? 'currentColor' }} />
        <input
          type="color"
          className="sr-only"
          value={current.color ?? '#000000'}
          onChange={(e) => applyStyle({ color: e.target.value })}
        />
      </label>

      <label
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-[var(--color-surface-hover)]"
        style={{ opacity: disabled ? 0.3 : 1, pointerEvents: disabled ? 'none' : undefined }}
        title="Cor de fundo"
      >
        <PaintBucket size={16} style={{ color: current.backgroundColor ?? 'currentColor' }} />
        <input
          type="color"
          className="sr-only"
          value={current.backgroundColor ?? '#ffffff'}
          onChange={(e) => applyStyle({ backgroundColor: e.target.value })}
        />
      </label>

      <ToolbarButton
        icon={AlignLeft}
        label="Alinhar à esquerda"
        active={current.align === 'left'}
        disabled={disabled}
        onClick={() => applyStyle({ align: 'left' as Alignment })}
      />
      <ToolbarButton
        icon={AlignCenter}
        label="Centralizar"
        active={current.align === 'center'}
        disabled={disabled}
        onClick={() => applyStyle({ align: 'center' as Alignment })}
      />
      <ToolbarButton
        icon={AlignRight}
        label="Alinhar à direita"
        active={current.align === 'right'}
        disabled={disabled}
        onClick={() => applyStyle({ align: 'right' as Alignment })}
      />

      <div className="relative" ref={numberMenuRef}>
        <ToolbarButton
          icon={Hash}
          label="Formato numérico da coluna"
          active={numberMenuOpen}
          disabled={disabled}
          onClick={() => setNumberMenuOpen((v) => !v)}
        />
        {numberMenuOpen && (
          <div
            className="absolute top-full left-0 z-50 mt-1 w-44 rounded-md border py-1 shadow-lg"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
          >
            {(Object.keys(FORMAT_LABELS) as NumberFormatKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  applyNumberFormat(k, currentFormat.decimals || 2);
                  setNumberMenuOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-[var(--color-surface-hover)]"
                style={{ color: currentFormat.kind === k ? 'var(--color-accent)' : 'var(--color-text)' }}
              >
                {FORMAT_LABELS[k]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
