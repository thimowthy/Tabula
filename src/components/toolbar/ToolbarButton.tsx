import type { LucideIcon } from 'lucide-react';

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}

export function ToolbarButton({ icon: Icon, label, onClick, active, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30 disabled:hover:bg-transparent"
      style={{
        color: active ? 'var(--color-accent)' : 'var(--color-text)',
        background: active ? 'var(--color-accent-soft)' : undefined,
      }}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}
