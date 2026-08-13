import type { LucideIcon } from 'lucide-react';
import { List } from 'lucide-react';
import { RibbonButton } from './RibbonButton';
import { DropdownMenu, type MenuItem } from '../ui/DropdownMenu';

export interface RibbonItem {
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface RibbonGroup {
  title: string;
  items: RibbonItem[];
}

/** One labeled cluster of related actions inside a guia — e.g. "Texto" or
 * "Condicional". Icon-only buttons, so several fit per row before wrapping. */
function Group({ title, items }: RibbonGroup) {
  return (
    <div className="flex h-full shrink-0 flex-col items-center justify-center gap-1.5 px-2.5">
      <div className="flex max-h-[70px] w-fit max-w-[280px] flex-wrap content-center justify-center gap-1 overflow-y-auto">
        {items.map((item) => (
          <RibbonButton
            key={item.label}
            icon={item.icon}
            label={item.label}
            onClick={item.onSelect}
            disabled={item.disabled}
            danger={item.danger}
          />
        ))}
      </div>
      <span
        className="text-[10px] font-medium tracking-wide uppercase"
        style={{ color: 'var(--color-text-subtle)' }}
      >
        {title}
      </span>
    </div>
  );
}

/** Flattens the icon groups back into the plain-text menu items the old
 * dropdown list used — separators mark where one group ends and the next
 * begins, same as the grouping shown visually in the icon row above it. */
function toMenuItems(groups: RibbonGroup[]): MenuItem[] {
  const out: MenuItem[] = [];
  groups.forEach((group, i) => {
    if (i > 0) out.push({ label: `sep-${i}`, separator: true });
    for (const item of group.items) {
      out.push({ label: item.label, onSelect: item.onSelect, disabled: item.disabled, danger: item.danger });
    }
  });
  return out;
}

/** One tab's worth of ribbon content: its actions as a fixed-height row of
 * icon-only buttons organized into labeled groups (scrolling horizontally
 * rather than growing taller if it doesn't fit), plus a "Lista" dropdown at
 * the end that restores the full text list for anyone who'd rather read
 * names than scan icons. */
export function RibbonGroups({ groups }: { groups: RibbonGroup[] }) {
  return (
    <div className="flex h-24 items-stretch gap-0 px-1">
      <div className="flex flex-1 items-stretch gap-0 overflow-x-auto overflow-y-hidden">
        {groups.map((group, i) => (
          <div key={group.title} className="flex shrink-0 items-stretch">
            {i > 0 && <div className="my-2 w-px shrink-0" style={{ background: 'var(--color-border)' }} />}
            <Group title={group.title} items={group.items} />
          </div>
        ))}
      </div>
      <div className="my-2 w-px shrink-0" style={{ background: 'var(--color-border)' }} />
      <div className="flex shrink-0 items-center px-1.5">
        <DropdownMenu
          trigger={
            <span title="Ver lista completa" aria-label="Ver lista completa">
              <List size={16} strokeWidth={2} />
            </span>
          }
          items={toMenuItems(groups)}
          align="right"
        />
      </div>
    </div>
  );
}
