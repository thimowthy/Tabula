import type { LucideIcon } from 'lucide-react';

interface RibbonButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/** Icon-only — the ribbon row is meant to be scanned at a glance, so the
 * name lives in the tooltip/aria-label rather than taking up row width. */
export function RibbonButton({ icon: Icon, label, onClick, disabled, danger }: RibbonButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30 disabled:hover:bg-transparent"
      style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  );
}
