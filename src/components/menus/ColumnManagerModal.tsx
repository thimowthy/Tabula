import { useActiveSheet, useWorkbookStore } from '../../store/useWorkbookStore';
import { Modal } from '../ui/Modal';
import type { ColumnType } from '../../model/types';

const TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  boolean: 'Booleano',
};

export function ColumnManagerModal({ onClose }: { onClose: () => void }) {
  const sheet = useActiveSheet();
  const dispatch = useWorkbookStore((s) => s.dispatch);

  function move(columnId: string, dir: -1 | 1) {
    const idx = sheet.columns.findIndex((c) => c.id === columnId);
    const swapWith = idx + dir;
    if (idx === -1 || swapWith < 0 || swapWith >= sheet.columns.length) return;
    // Moving up: sit before the column currently just above. Moving down: sit
    // before whatever comes after the column currently just below (or at the
    // end, if there's nothing after it) — either way this swaps the two.
    const beforeColumnId = dir === -1 ? sheet.columns[idx - 1].id : (sheet.columns[idx + 2]?.id ?? null);
    dispatch({ type: 'MOVE_COLUMN', payload: { sheetId: sheet.id, columnId, beforeColumnId } });
  }

  return (
    <Modal title="Gerenciar colunas" onClose={onClose} width={640}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[11px] text-[var(--color-text-subtle)]">
              <th className="px-1.5 py-1 font-medium">Nome</th>
              <th className="px-1.5 py-1 font-medium">Tipo</th>
              <th className="px-1.5 py-1 font-medium">Largura</th>
              <th className="px-1.5 py-1 text-center font-medium">Visível</th>
              <th className="px-1.5 py-1 text-center font-medium">Congelar</th>
              <th className="px-1.5 py-1 text-center font-medium">Ordem</th>
              <th className="px-1.5 py-1 text-center font-medium">Excluir</th>
            </tr>
          </thead>
          <tbody>
            {sheet.columns.map((col, idx) => (
              <tr key={col.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-1.5 py-1">
                  <input
                    className="w-32 rounded border px-1.5 py-1"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                    value={col.name}
                    onChange={(e) =>
                      dispatch({ type: 'RENAME_COLUMN', payload: { sheetId: sheet.id, columnId: col.id, name: e.target.value } })
                    }
                  />
                </td>
                <td className="px-1.5 py-1">
                  <select
                    className="rounded border px-1.5 py-1"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                    value={col.type}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_COLUMN_TYPE',
                        payload: { sheetId: sheet.id, columnId: col.id, columnType: e.target.value as ColumnType },
                      })
                    }
                  >
                    {(Object.keys(TYPE_LABELS) as ColumnType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1.5 py-1">
                  <input
                    type="number"
                    min={40}
                    className="w-16 rounded border px-1.5 py-1"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                    value={col.width}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_COLUMN_WIDTH',
                        payload: { sheetId: sheet.id, columnId: col.id, width: Number(e.target.value) || 50 },
                      })
                    }
                  />
                </td>
                <td className="px-1.5 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => dispatch({ type: 'TOGGLE_COLUMN_VISIBILITY', payload: { sheetId: sheet.id, columnId: col.id } })}
                  />
                </td>
                <td className="px-1.5 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={col.frozen}
                    onChange={(e) =>
                      dispatch({ type: 'SET_COLUMN_FROZEN', payload: { sheetId: sheet.id, columnId: col.id, frozen: e.target.checked } })
                    }
                  />
                </td>
                <td className="px-1.5 py-1">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => move(col.id, -1)}
                      className="rounded border px-1.5 disabled:opacity-30"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === sheet.columns.length - 1}
                      onClick={() => move(col.id, 1)}
                      className="rounded border px-1.5 disabled:opacity-30"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-1.5 py-1 text-center">
                  <button
                    type="button"
                    disabled={sheet.columns.length <= 1}
                    onClick={() => dispatch({ type: 'DELETE_COLUMNS', payload: { sheetId: sheet.id, columnIds: [col.id] } })}
                    className="rounded px-1.5 disabled:opacity-30"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => dispatch({ type: 'INSERT_COLUMN', payload: { sheetId: sheet.id, atIndex: sheet.columns.length } })}
        className="mt-3 rounded border px-3 py-1.5 text-[13px]"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        + Adicionar coluna
      </button>
    </Modal>
  );
}
