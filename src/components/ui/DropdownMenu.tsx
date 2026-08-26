import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  /** Opens the menu on hover (with a short close delay) in addition to click — used for the Tabula brand menu. */
  openOnHover?: boolean;
}

export function DropdownMenu({ trigger, items, align = 'left', openOnHover = false }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  function handleMouseEnter() {
    if (!openOnHover) return;
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }

  function handleMouseLeave() {
    if (!openOnHover) return;
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative" ref={ref} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 shrink-0 items-center rounded px-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] data-[open=true]:bg-[var(--color-surface-hover)]"
        data-open={open}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`tabula-menu-pop absolute top-full z-50 mt-1 max-h-[70vh] min-w-[190px] overflow-y-auto rounded-md border py-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
        >
          {items.map((item, i) =>
            item.separator ? (
              <div key={i} className="my-1 h-px" style={{ background: 'var(--color-border)' }} />
            ) : (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] disabled:opacity-40"
                style={{ color: item.danger ? 'var(--color-danger)' : 'var(--color-text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {item.icon && <item.icon size={14} className="shrink-0" style={{ color: 'var(--color-text-subtle)' }} />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function useContextMenu() {
  const [state, setState] = useState<{ x: number; y: number } | null>(null);
  return {
    position: state,
    open: (e: React.MouseEvent) => {
      e.preventDefault();
      setState({ x: e.clientX, y: e.clientY });
    },
    close: () => setState(null),
  };
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[170px] rounded-md border py-1 shadow-lg"
      style={{ left: x, top: y, borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 h-px" style={{ background: 'var(--color-border)' }} />
        ) : (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect?.();
              onClose();
            }}
            className="block w-full px-3 py-1.5 text-left text-[13px] disabled:opacity-40"
            style={{ color: item.danger ? 'var(--color-danger)' : 'var(--color-text)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
