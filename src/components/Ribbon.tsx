import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Wand2, Table2, Columns3 } from 'lucide-react';
import { OperationsMenu } from './menus/OperationsMenu';
import { DataMenu } from './menus/DataMenu';
import { ColumnsMenu } from './menus/ColumnsMenu';

type RibbonTab = 'operacoes' | 'dados' | 'colunas';

const TABS: { id: RibbonTab; label: string; icon: LucideIcon }[] = [
  { id: 'operacoes', label: 'Operações', icon: Wand2 },
  { id: 'dados', label: 'Dados', icon: Table2 },
  { id: 'colunas', label: 'Colunas', icon: Columns3 },
];

/** Second bar under the toolbar, ribbon-style: a strip of guias (Operações /
 * Dados / Colunas) whose active tab's actions render below as a row of icon
 * buttons, instead of each living behind its own dropdown in the toolbar. */
export function Ribbon() {
  const [tab, setTab] = useState<RibbonTab>('operacoes');

  return (
    <div className="shrink-0 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="flex items-center gap-1 px-2 pt-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 rounded-t px-3 py-1.5 text-[12.5px] font-medium"
              style={{
                borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                color: active ? 'var(--color-accent)' : 'var(--color-text-subtle)',
                background: active ? 'var(--color-bg)' : undefined,
              }}
            >
              <Icon size={14} strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
        {tab === 'operacoes' && <OperationsMenu />}
        {tab === 'dados' && <DataMenu />}
        {tab === 'colunas' && <ColumnsMenu />}
      </div>
    </div>
  );
}
