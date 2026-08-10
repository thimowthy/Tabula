import { v4 as uuid } from 'uuid';
import { createColumn, createEmptySheet, createRow } from '../model/factory';
import { getSheet, updateSheet } from '../model/ops';
import { evaluateFilter } from '../model/filterEval';
import type { CellValue, ColumnDef, RowRecord, SheetModel, WorkbookModel } from '../model/types';
import { createWorkflowStep } from '../workflow/operations';
import type { AppCommand } from './types';

export interface ApplyResult {
  workbook: WorkbookModel;
  label: string;
}

function evaluateTemplate(template: string, cells: Record<string, CellValue>, columns: ColumnDef[]): string {
  return template.replace(/\{([^{}]+)\}/g, (_match, name: string) => {
    const col = columns.find((c) => c.name === name);
    if (!col) return '';
    const v = cells[col.id];
    return v === null || v === undefined ? '' : String(v);
  });
}

function compareValues(a: CellValue, b: CellValue, type: ColumnDef['type']): number {
  if (a === null || a === '') return 1;
  if (b === null || b === '') return -1;
  if (type === 'number') return Number(a) - Number(b);
  if (type === 'boolean') return Number(a) - Number(b);
  if (type === 'date') return new Date(String(a)).getTime() - new Date(String(b)).getTime();
  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
}

function cloneSheetWithNewIds(sheet: SheetModel, newName: string): SheetModel {
  const columnIdMap = new Map<string, string>();
  const columns: ColumnDef[] = sheet.columns.map((c) => {
    const newId = uuid();
    columnIdMap.set(c.id, newId);
    return { ...c, id: newId, numberFormat: { ...c.numberFormat }, style: { ...c.style } };
  });
  const rows: RowRecord[] = sheet.rows.map((r) => {
    const cells: Record<string, CellValue> = {};
    for (const [oldColId, val] of Object.entries(r.cells)) {
      const newColId = columnIdMap.get(oldColId);
      if (newColId) cells[newColId] = val;
    }
    let styles: Record<string, import('../model/types').CellStyle> | undefined;
    if (r.styles) {
      styles = {};
      for (const [oldColId, style] of Object.entries(r.styles)) {
        const newColId = columnIdMap.get(oldColId);
        if (newColId) styles[newColId] = { ...style };
      }
    }
    return { id: uuid(), cells, styles };
  });
  return { id: uuid(), name: newName, columns, rows, workflowSteps: [...sheet.workflowSteps] };
}

export function applyCommand(workbook: WorkbookModel, command: AppCommand): ApplyResult {
  switch (command.type) {
    case 'EDIT_CELL': {
      const { sheetId, rowId, columnId, value } = command.payload;
      const next = updateSheet(workbook, sheetId, (sheet) => ({
        ...sheet,
        rows: sheet.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [columnId]: value } } : r)),
      }));
      return { workbook: next, label: 'Editar célula' };
    }

    case 'EDIT_CELLS_BULK': {
      const { sheetId, edits } = command.payload;
      const byRow = new Map<string, Record<string, CellValue>>();
      for (const e of edits) {
        const existing = byRow.get(e.rowId) ?? {};
        existing[e.columnId] = e.value;
        byRow.set(e.rowId, existing);
      }
      const next = updateSheet(workbook, sheetId, (sheet) => ({
        ...sheet,
        rows: sheet.rows.map((r) => {
          const patch = byRow.get(r.id);
          return patch ? { ...r, cells: { ...r.cells, ...patch } } : r;
        }),
      }));
      return { workbook: next, label: 'Colar' };
    }

    case 'INSERT_ROWS': {
      const { sheetId, atIndex, count } = command.payload;
      const sheet = getSheet(workbook, sheetId);
      const newRows = Array.from({ length: count }, () => {
        const cells: Record<string, CellValue> = {};
        for (const col of sheet.columns) cells[col.id] = null;
        return createRow(cells);
      });
      const next = updateSheet(workbook, sheetId, (s) => {
        const rows = [...s.rows];
        rows.splice(atIndex, 0, ...newRows);
        return { ...s, rows };
      });
      return { workbook: next, label: 'Inserir linha' };
    }

    case 'DELETE_ROWS': {
      const { sheetId, rowIds } = command.payload;
      const idSet = new Set(rowIds);
      const next = updateSheet(workbook, sheetId, (s) => ({ ...s, rows: s.rows.filter((r) => !idSet.has(r.id)) }));
      return { workbook: next, label: 'Excluir linha' };
    }

    case 'INSERT_COLUMN': {
      const { sheetId, atIndex, name } = command.payload;
      const sheet = getSheet(workbook, sheetId);
      const newColumn = createColumn({ name: name ?? `Coluna ${sheet.columns.length + 1}` });
      const next = updateSheet(workbook, sheetId, (s) => {
        const columns = [...s.columns];
        columns.splice(atIndex, 0, newColumn);
        const rows = s.rows.map((r) => ({ ...r, cells: { ...r.cells, [newColumn.id]: null } }));
        return {
          ...s,
          columns,
          rows,
          workflowSteps: [
            ...s.workflowSteps,
            createWorkflowStep('add_column', {
              name: newColumn.name,
              column_type: newColumn.type,
              default_value: null,
            }),
          ],
        };
      });
      return { workbook: next, label: 'Inserir coluna' };
    }

    case 'DELETE_COLUMNS': {
      const { sheetId, columnIds } = command.payload;
      const idSet = new Set(columnIds);
      const sheetBefore = getSheet(workbook, sheetId);
      const removedNames = sheetBefore.columns.filter((c) => idSet.has(c.id)).map((c) => c.name);
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.filter((c) => !idSet.has(c.id)),
        rows: s.rows.map((r) => {
          const cells = { ...r.cells };
          for (const id of columnIds) delete cells[id];
          let styles = r.styles;
          if (styles) {
            styles = { ...styles };
            for (const id of columnIds) delete styles[id];
          }
          return { ...r, cells, styles };
        }),
        workflowSteps:
          removedNames.length > 0
            ? [...s.workflowSteps, createWorkflowStep('drop_columns', { columns: removedNames })]
            : s.workflowSteps,
      }));
      return { workbook: next, label: 'Excluir coluna' };
    }

    case 'RENAME_COLUMN': {
      const { sheetId, columnId, name } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const oldName = sheetBefore.columns.find((c) => c.id === columnId)?.name;
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, name } : c)),
        workflowSteps:
          oldName && oldName !== name
            ? [...s.workflowSteps, createWorkflowStep('rename_column', { column: oldName, new_name: name })]
            : s.workflowSteps,
      }));
      return { workbook: next, label: 'Renomear coluna' };
    }

    case 'SET_COLUMN_TYPE': {
      const { sheetId, columnId, columnType } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const columnBefore = sheetBefore.columns.find((c) => c.id === columnId);
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, type: columnType } : c)),
        workflowSteps:
          columnBefore && columnBefore.type !== columnType
            ? [
                ...s.workflowSteps,
                createWorkflowStep('cast_column_type', { column: columnBefore.name, target_type: columnType }),
              ]
            : s.workflowSteps,
      }));
      return { workbook: next, label: 'Alterar tipo da coluna' };
    }

    case 'SET_COLUMN_WIDTH': {
      const { sheetId, columnId, width } = command.payload;
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, width } : c)),
      }));
      return { workbook: next, label: 'Redimensionar coluna' };
    }

    case 'SET_COLUMN_FORMAT': {
      const { sheetId, columnId, numberFormat } = command.payload;
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, numberFormat } : c)),
      }));
      return { workbook: next, label: 'Alterar formato' };
    }

    case 'SET_COLUMN_STYLE': {
      const { sheetId, columnId, style } = command.payload;
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, style: { ...c.style, ...style } } : c)),
      }));
      return { workbook: next, label: 'Formatar coluna' };
    }

    case 'MOVE_COLUMN': {
      const { sheetId, columnId, beforeColumnId } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const movedColumn = sheetBefore.columns.find((c) => c.id === columnId);
      if (!movedColumn || columnId === beforeColumnId) return { workbook, label: 'Mover coluna' };
      const beforeColumn = beforeColumnId ? sheetBefore.columns.find((c) => c.id === beforeColumnId) : undefined;
      const next = updateSheet(workbook, sheetId, (s) => {
        const remaining = s.columns.filter((c) => c.id !== columnId);
        const insertAt = beforeColumnId ? remaining.findIndex((c) => c.id === beforeColumnId) : -1;
        const columns = [...remaining];
        columns.splice(insertAt === -1 ? remaining.length : insertAt, 0, movedColumn);
        return {
          ...s,
          columns,
          workflowSteps: [
            ...s.workflowSteps,
            createWorkflowStep('reorder_column', { column: movedColumn.name, before: beforeColumn?.name ?? null }),
          ],
        };
      });
      return { workbook: next, label: 'Mover coluna' };
    }

    case 'TOGGLE_COLUMN_VISIBILITY': {
      const { sheetId, columnId } = command.payload;
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, visible: !c.visible } : c)),
      }));
      return { workbook: next, label: 'Alternar visibilidade da coluna' };
    }

    case 'SET_COLUMN_FROZEN': {
      const { sheetId, columnId, frozen } = command.payload;
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, frozen } : c)),
      }));
      return { workbook: next, label: frozen ? 'Congelar coluna' : 'Descongelar coluna' };
    }

    case 'SORT_ROWS': {
      const { sheetId, columnId, direction } = command.payload;
      const sheet = getSheet(workbook, sheetId);
      const column = sheet.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Ordenar' };
      const next = updateSheet(workbook, sheetId, (s) => {
        const rows = [...s.rows].sort((a, b) => {
          const cmp = compareValues(a.cells[columnId], b.cells[columnId], column.type);
          return direction === 'ASC' ? cmp : -cmp;
        });
        return { ...s, rows };
      });
      return { workbook: next, label: 'Ordenar' };
    }

    case 'SET_CELLS_STYLE': {
      const { sheetId, targets, style } = command.payload;
      const byRow = new Map<string, Set<string>>();
      for (const t of targets) {
        const set = byRow.get(t.rowId) ?? new Set<string>();
        set.add(t.columnId);
        byRow.set(t.rowId, set);
      }
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) => {
          const cols = byRow.get(r.id);
          if (!cols) return r;
          const styles = { ...(r.styles ?? {}) };
          for (const colId of cols) styles[colId] = { ...styles[colId], ...style };
          return { ...r, styles };
        }),
      }));
      return { workbook: next, label: 'Formatar células' };
    }

    case 'FIND_REPLACE': {
      const { sheetId, find, replace, matchCase, columnIds } = command.payload;
      if (find === '') return { workbook, label: 'Localizar e substituir' };
      const flags = matchCase ? 'g' : 'gi';
      const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      const next = updateSheet(workbook, sheetId, (s) => {
        const targetCols = new Set(columnIds && columnIds.length > 0 ? columnIds : s.columns.map((c) => c.id));
        return {
          ...s,
          rows: s.rows.map((r) => {
            let changed = false;
            const cells = { ...r.cells };
            for (const colId of targetCols) {
              const val = cells[colId];
              if (typeof val === 'string' && pattern.test(val)) {
                cells[colId] = val.replace(pattern, replace);
                changed = true;
              }
            }
            return changed ? { ...r, cells } : r;
          }),
        };
      });
      return { workbook: next, label: 'Localizar e substituir' };
    }

    case 'ADD_SHEET': {
      const name = command.payload.name ?? `Planilha${workbook.sheets.length + 1}`;
      const sheet = createEmptySheet(name);
      return {
        workbook: { sheets: [...workbook.sheets, sheet], activeSheetId: sheet.id },
        label: 'Nova aba',
      };
    }

    case 'RENAME_SHEET': {
      const { sheetId, name } = command.payload;
      return {
        workbook: {
          ...workbook,
          sheets: workbook.sheets.map((s) => (s.id === sheetId ? { ...s, name } : s)),
        },
        label: 'Renomear aba',
      };
    }

    case 'DELETE_SHEET': {
      const { sheetId } = command.payload;
      if (workbook.sheets.length <= 1) return { workbook, label: 'Excluir aba' };
      const idx = workbook.sheets.findIndex((s) => s.id === sheetId);
      const sheets = workbook.sheets.filter((s) => s.id !== sheetId);
      const activeSheetId =
        workbook.activeSheetId === sheetId
          ? (sheets[Math.max(0, idx - 1)]?.id ?? sheets[0].id)
          : workbook.activeSheetId;
      return { workbook: { sheets, activeSheetId }, label: 'Excluir aba' };
    }

    case 'DUPLICATE_SHEET': {
      const { sheetId } = command.payload;
      const sheet = getSheet(workbook, sheetId);
      const copy = cloneSheetWithNewIds(sheet, `${sheet.name} (cópia)`);
      const idx = workbook.sheets.findIndex((s) => s.id === sheetId);
      const sheets = [...workbook.sheets];
      sheets.splice(idx + 1, 0, copy);
      return { workbook: { sheets, activeSheetId: copy.id }, label: 'Duplicar aba' };
    }

    case 'REORDER_SHEETS': {
      const { orderedSheetIds } = command.payload;
      const byId = new Map(workbook.sheets.map((s) => [s.id, s]));
      const sheets = orderedSheetIds.map((id) => byId.get(id)).filter((s): s is SheetModel => !!s);
      return { workbook: { ...workbook, sheets }, label: 'Reordenar abas' };
    }

    case 'CLEAR_SHEET': {
      const { sheetId } = command.payload;
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) => {
          const cells: Record<string, CellValue> = {};
          for (const col of s.columns) cells[col.id] = null;
          return { ...r, cells, styles: undefined };
        }),
      }));
      return { workbook: next, label: 'Limpar planilha' };
    }

    case 'TRIM_WHITESPACE': {
      const { sheetId, columnIds } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const targetColumns =
        columnIds.length > 0
          ? sheetBefore.columns.filter((c) => columnIds.includes(c.id))
          : sheetBefore.columns.filter((c) => c.type === 'text');
      const targetIds = new Set(targetColumns.map((c) => c.id));
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) => {
          let changed = false;
          const cells = { ...r.cells };
          for (const id of targetIds) {
            const v = cells[id];
            if (typeof v === 'string') {
              const trimmed = v.trim();
              if (trimmed !== v) {
                cells[id] = trimmed;
                changed = true;
              }
            }
          }
          return changed ? { ...r, cells } : r;
        }),
        workflowSteps: [
          ...s.workflowSteps,
          createWorkflowStep('trim_whitespace', { columns: targetColumns.map((c) => c.name) }),
        ],
      }));
      return { workbook: next, label: 'Remover espaços em excesso' };
    }

    case 'FILL_NULL': {
      const { sheetId, columnId, value } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Preencher vazios' };
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) => {
          const current = r.cells[columnId];
          return current === null || current === '' || current === undefined
            ? { ...r, cells: { ...r.cells, [columnId]: value } }
            : r;
        }),
        workflowSteps: [...s.workflowSteps, createWorkflowStep('fill_null', { column: column.name, value })],
      }));
      return { workbook: next, label: 'Preencher vazios' };
    }

    case 'APPLY_FILTER_STEP': {
      const { sheetId, columnId, operator, value } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Filtrar linhas' };
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        rows: s.rows.filter((r) => evaluateFilter(r.cells[columnId], operator, value)),
        workflowSteps: [
          ...s.workflowSteps,
          createWorkflowStep('filter_rows', { column: column.name, operator, value }),
        ],
      }));
      return { workbook: next, label: 'Filtrar linhas (etapa do workflow)' };
    }

    case 'CAST_TO_INTEGER': {
      const { sheetId, columnId } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Converter para inteiro' };
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, type: 'number' } : c)),
        rows: s.rows.map((r) => {
          const raw = r.cells[columnId];
          const num = typeof raw === 'number' ? raw : raw === null || raw === '' ? null : Number(raw);
          const value = num === null || Number.isNaN(num) ? null : Math.trunc(num);
          return { ...r, cells: { ...r.cells, [columnId]: value } };
        }),
        workflowSteps: [...s.workflowSteps, createWorkflowStep('cast_to_integer', { column: column.name })],
      }));
      return { workbook: next, label: 'Converter para inteiro' };
    }

    case 'CAST_TO_FLOAT': {
      const { sheetId, columnId } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Converter para decimal' };
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, type: 'number' } : c)),
        rows: s.rows.map((r) => {
          const raw = r.cells[columnId];
          const num = typeof raw === 'number' ? raw : raw === null || raw === '' ? null : Number(raw);
          return { ...r, cells: { ...r.cells, [columnId]: num === null || Number.isNaN(num) ? null : num } };
        }),
        workflowSteps: [...s.workflowSteps, createWorkflowStep('cast_to_float', { column: column.name })],
      }));
      return { workbook: next, label: 'Converter para decimal' };
    }

    case 'CAST_TO_DATETIME': {
      const { sheetId, columnId, format } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Converter para data e hora' };
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, type: 'date' } : c)),
        rows: s.rows.map((r) => {
          const raw = r.cells[columnId];
          let value: CellValue = null;
          if (typeof raw === 'string' && raw.trim() !== '') {
            const t = Date.parse(raw);
            value = Number.isNaN(t) ? null : new Date(t).toISOString();
          } else if (typeof raw === 'number') {
            value = new Date(raw).toISOString();
          }
          return { ...r, cells: { ...r.cells, [columnId]: value } };
        }),
        workflowSteps: [
          ...s.workflowSteps,
          createWorkflowStep('cast_to_datetime', { column: column.name, format: format ?? null }),
        ],
      }));
      return { workbook: next, label: 'Converter para data e hora' };
    }

    case 'SPLIT_COLUMN': {
      const { sheetId, columnId, delimiter, newNames, keepOriginal } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const sourceColumn = sheetBefore.columns.find((c) => c.id === columnId);
      if (!sourceColumn || newNames.length === 0) return { workbook, label: 'Dividir coluna' };
      const newColumns = newNames.map((name) => createColumn({ name }));
      const sourceIdx = sheetBefore.columns.findIndex((c) => c.id === columnId);
      const next = updateSheet(workbook, sheetId, (s) => {
        const columns = [...s.columns];
        columns.splice(sourceIdx + 1, 0, ...newColumns);
        const finalColumns = keepOriginal ? columns : columns.filter((c) => c.id !== columnId);
        const rows = s.rows.map((r) => {
          const raw = r.cells[columnId];
          const parts = typeof raw === 'string' ? raw.split(delimiter) : [];
          const cells = { ...r.cells };
          newColumns.forEach((col, i) => {
            cells[col.id] = parts[i] ?? null;
          });
          if (!keepOriginal) delete cells[columnId];
          return { ...r, cells };
        });
        return {
          ...s,
          columns: finalColumns,
          rows,
          workflowSteps: [
            ...s.workflowSteps,
            createWorkflowStep('split_column', {
              column: sourceColumn.name,
              delimiter,
              into: newNames,
              keep_original: keepOriginal,
            }),
          ],
        };
      });
      return { workbook: next, label: 'Dividir coluna' };
    }

    case 'FILL_CONSTANT': {
      const { sheetId, columnId, value } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Preencher com constante' };
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) => ({ ...r, cells: { ...r.cells, [columnId]: value } })),
        workflowSteps: [...s.workflowSteps, createWorkflowStep('fill_constant', { column: column.name, value })],
      }));
      return { workbook: next, label: 'Preencher com constante' };
    }

    case 'APPLY_MATH': {
      const { sheetId, columnId, operator, operandType, operand, outputColumnName } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const sourceColumn = sheetBefore.columns.find((c) => c.id === columnId);
      if (!sourceColumn) return { workbook, label: 'Operação matemática' };
      const operandColumn = operandType === 'column' ? sheetBefore.columns.find((c) => c.id === operand) : undefined;
      if (operandType === 'column' && !operandColumn) return { workbook, label: 'Operação matemática' };

      const applyOp = (a: number, b: number): number => {
        switch (operator) {
          case 'add':
            return a + b;
          case 'subtract':
            return a - b;
          case 'multiply':
            return a * b;
          case 'divide':
            return a / b;
        }
      };

      const newColumn = outputColumnName ? createColumn({ name: outputColumnName, type: 'number' }) : undefined;
      const targetColumnId = newColumn?.id ?? columnId;
      const sourceIdx = sheetBefore.columns.findIndex((c) => c.id === columnId);

      const next = updateSheet(workbook, sheetId, (s) => {
        let columns = s.columns;
        if (newColumn) {
          columns = [...s.columns];
          columns.splice(sourceIdx + 1, 0, newColumn);
        } else {
          columns = s.columns.map((c) => (c.id === columnId ? { ...c, type: 'number' } : c));
        }
        const rows = s.rows.map((r) => {
          const leftRaw = r.cells[columnId];
          const left = typeof leftRaw === 'number' ? leftRaw : leftRaw === null || leftRaw === '' ? NaN : Number(leftRaw);
          let right: number;
          if (operandType === 'constant') {
            right = operand as number;
          } else {
            const rightRaw = r.cells[operand as string];
            right = typeof rightRaw === 'number' ? rightRaw : rightRaw === null || rightRaw === '' ? NaN : Number(rightRaw);
          }
          const result = Number.isNaN(left) || Number.isNaN(right) ? null : applyOp(left, right);
          return { ...r, cells: { ...r.cells, [targetColumnId]: result } };
        });
        return {
          ...s,
          columns,
          rows,
          workflowSteps: [
            ...s.workflowSteps,
            createWorkflowStep('math_operation', {
              column: sourceColumn.name,
              operator,
              operand_type: operandType,
              operand: operandType === 'column' ? (operandColumn?.name ?? '') : operand,
              output_column: outputColumnName ?? null,
            }),
          ],
        };
      });
      return { workbook: next, label: 'Operação matemática' };
    }

    case 'PAD_STRING': {
      const { sheetId, columnId, length, padChar, side } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Preencher tamanho fixo' };
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, type: 'text' } : c)),
        rows: s.rows.map((r) => {
          const raw = r.cells[columnId];
          if (raw === null || raw === undefined) return r;
          const str = typeof raw === 'number' ? String(Math.trunc(raw)) : String(raw);
          const padded = side === 'left' ? str.padStart(length, padChar || ' ') : str.padEnd(length, padChar || ' ');
          return { ...r, cells: { ...r.cells, [columnId]: padded } };
        }),
        workflowSteps: [
          ...s.workflowSteps,
          createWorkflowStep('pad_string', { column: column.name, length, pad_char: padChar, side }),
        ],
      }));
      return { workbook: next, label: 'Preencher tamanho fixo' };
    }

    case 'CONCAT_COLUMNS': {
      const { sheetId, template, outputColumnName } = command.payload;
      const trimmedName = outputColumnName.trim();
      if (!trimmedName) return { workbook, label: 'Concatenar colunas' };
      const newColumn = createColumn({ name: trimmedName, type: 'text' });
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: [...s.columns, newColumn],
        rows: s.rows.map((r) => ({
          ...r,
          cells: { ...r.cells, [newColumn.id]: evaluateTemplate(template, r.cells, s.columns) },
        })),
        workflowSteps: [
          ...s.workflowSteps,
          createWorkflowStep('concat_columns', { template, output_column: trimmedName }),
        ],
      }));
      return { workbook: next, label: 'Concatenar colunas' };
    }

    case 'REPLACE_TEXT': {
      const { sheetId, columnId, find, replace, regex, matchCase } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column || find === '') return { workbook, label: 'Substituir texto' };
      const pattern = regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let pat: RegExp;
      try {
        pat = new RegExp(pattern, matchCase ? 'g' : 'gi');
      } catch {
        return { workbook, label: 'Substituir texto' };
      }
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) => {
          const v = r.cells[columnId];
          if (typeof v !== 'string') return r;
          const newVal = v.replace(pat, replace);
          return newVal === v ? r : { ...r, cells: { ...r.cells, [columnId]: newVal } };
        }),
        workflowSteps: [
          ...s.workflowSteps,
          createWorkflowStep('replace', { column: column.name, find, replace, regex, match_case: matchCase }),
        ],
      }));
      return { workbook: next, label: 'Substituir texto' };
    }

    case 'EXTRACT_TEXT': {
      const { sheetId, columnId, pattern, group, outputColumnName } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const sourceColumn = sheetBefore.columns.find((c) => c.id === columnId);
      if (!sourceColumn) return { workbook, label: 'Extrair texto' };
      let pat: RegExp;
      try {
        pat = new RegExp(pattern);
      } catch {
        return { workbook, label: 'Extrair texto' };
      }
      const newColumn = outputColumnName ? createColumn({ name: outputColumnName, type: 'text' }) : undefined;
      const targetColumnId = newColumn?.id ?? columnId;
      const sourceIdx = sheetBefore.columns.findIndex((c) => c.id === columnId);
      const next = updateSheet(workbook, sheetId, (s) => {
        let columns = s.columns;
        if (newColumn) {
          columns = [...s.columns];
          columns.splice(sourceIdx + 1, 0, newColumn);
        } else {
          columns = s.columns.map((c) => (c.id === columnId ? { ...c, type: 'text' } : c));
        }
        const rows = s.rows.map((r) => {
          const v = r.cells[columnId];
          const m = typeof v === 'string' ? pat.exec(v) : null;
          const extracted = m ? (m[group] ?? null) : null;
          return { ...r, cells: { ...r.cells, [targetColumnId]: extracted } };
        });
        return {
          ...s,
          columns,
          rows,
          workflowSteps: [
            ...s.workflowSteps,
            createWorkflowStep('extract', {
              column: sourceColumn.name,
              pattern,
              group,
              output_column: outputColumnName ?? null,
            }),
          ],
        };
      });
      return { workbook: next, label: 'Extrair texto' };
    }

    case 'MAP_VALUES': {
      const { sheetId, columnId, mapping } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Substituir valores (de-para)' };
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) => {
          const v = r.cells[columnId];
          const key = v === null || v === undefined ? null : String(v);
          if (key === null || !(key in mapping)) return r;
          return { ...r, cells: { ...r.cells, [columnId]: mapping[key] } };
        }),
        workflowSteps: [...s.workflowSteps, createWorkflowStep('map_values', { column: column.name, mapping })],
      }));
      return { workbook: next, label: 'Substituir valores (de-para)' };
    }

    case 'ROUND_NUMBER': {
      const { sheetId, columnId, decimals } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const column = sheetBefore.columns.find((c) => c.id === columnId);
      if (!column) return { workbook, label: 'Arredondar' };
      const factor = 10 ** decimals;
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, type: 'number' } : c)),
        rows: s.rows.map((r) => {
          const raw = r.cells[columnId];
          const num = typeof raw === 'number' ? raw : raw === null || raw === '' ? null : Number(raw);
          const value = num === null || Number.isNaN(num) ? null : Math.round(num * factor) / factor;
          return { ...r, cells: { ...r.cells, [columnId]: value } };
        }),
        workflowSteps: [...s.workflowSteps, createWorkflowStep('round', { column: column.name, decimals })],
      }));
      return { workbook: next, label: 'Arredondar' };
    }

    case 'DEDUPLICATE_ROWS': {
      const { sheetId, columnIds } = command.payload;
      const sheetBefore = getSheet(workbook, sheetId);
      const targetColumns =
        columnIds.length > 0 ? sheetBefore.columns.filter((c) => columnIds.includes(c.id)) : sheetBefore.columns;
      const next = updateSheet(workbook, sheetId, (s) => {
        const seen = new Set<string>();
        const rows = s.rows.filter((r) => {
          const key = JSON.stringify(targetColumns.map((c) => r.cells[c.id] ?? null));
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return {
          ...s,
          rows,
          workflowSteps: [
            ...s.workflowSteps,
            createWorkflowStep('deduplicate', { columns: targetColumns.map((c) => c.name) }),
          ],
        };
      });
      return { workbook: next, label: 'Remover duplicadas' };
    }

    case 'ADD_COLUMN_STEP': {
      const { sheetId, name, columnType, defaultValue } = command.payload;
      const trimmedName = name.trim();
      if (!trimmedName) return { workbook, label: 'Adicionar coluna' };
      const newColumn = createColumn({ name: trimmedName, type: columnType });
      const next = updateSheet(workbook, sheetId, (s) => ({
        ...s,
        columns: [...s.columns, newColumn],
        rows: s.rows.map((r) => ({ ...r, cells: { ...r.cells, [newColumn.id]: defaultValue } })),
        workflowSteps: [
          ...s.workflowSteps,
          createWorkflowStep('add_column', { name: trimmedName, column_type: columnType, default_value: defaultValue }),
        ],
      }));
      return { workbook: next, label: 'Adicionar coluna' };
    }

    case 'IMPORT_SHEETS': {
      const { sheets } = command.payload;
      if (sheets.length === 0) return { workbook, label: 'Importar planilha' };
      return {
        workbook: { sheets: [...workbook.sheets, ...sheets], activeSheetId: sheets[0].id },
        label: 'Importar planilha',
      };
    }

    default:
      return { workbook, label: 'Ação' };
  }
}
