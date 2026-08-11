import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

/** A floating, draggable panel — not a blocking dialog. There is deliberately
 * no dimmed backdrop and no "click outside to close": the sheet behind it
 * stays fully interactive (click cells, scroll, use other menus) while the
 * modal is open, since several of these modals are meant to be filled in
 * while looking at / selecting from the live grid. Close via the × button or
 * Escape. */
export function Modal({ title, onClose, children, width = 420 }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [onClose]);

  // Centered on first paint, based on the box's actual measured size.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: Math.max(8, (window.innerHeight - rect.height) / 2),
      left: Math.max(8, (window.innerWidth - rect.width) / 2),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDragStart(e: React.MouseEvent) {
    if (!position) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: position.top, startLeft: position.left };
    function onMove(ev: MouseEvent) {
      const drag = dragRef.current;
      const el = boxRef.current;
      if (!drag || !el) return;
      const maxTop = Math.max(0, window.innerHeight - el.offsetHeight);
      const maxLeft = Math.max(0, window.innerWidth - el.offsetWidth);
      setPosition({
        top: Math.min(maxTop, Math.max(0, drag.startTop + (ev.clientY - drag.startY))),
        left: Math.min(maxLeft, Math.max(0, drag.startLeft + (ev.clientX - drag.startX))),
      });
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={boxRef}
      className="fixed z-[100] flex max-h-[80vh] flex-col rounded-lg border shadow-xl"
      style={{
        width,
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg)',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div
        className="flex cursor-move items-center justify-between border-b px-4 py-3 select-none"
        style={{ borderColor: 'var(--color-border)' }}
        onMouseDown={onDragStart}
      >
        <h2 className="text-[14px] font-semibold text-[var(--color-text)]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-[15px] text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]"
        >
          ×
        </button>
      </div>
      <div className="overflow-y-auto px-4 py-3">{children}</div>
    </div>
  );
}
