import type { CellValue, ColumnDef } from './types';

export function formatCellValue(value: CellValue, column: ColumnDef): string {
  if (value === null || value === undefined || value === '') return '';

  if (column.type === 'boolean') {
    return value === true || value === 'TRUE' ? 'TRUE' : 'FALSE';
  }

  if (column.type === 'number') {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) return String(value);
    const { kind, decimals, currencySymbol } = column.numberFormat;
    if (kind === 'currency') {
      return `${currencySymbol ?? 'R$'} ${num.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    }
    if (kind === 'percent') {
      return `${(num * 100).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}%`;
    }
    if (kind === 'decimal') {
      return num.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return String(num).replace('.', ',');
  }

  if (column.type === 'date') {
    const d = typeof value === 'string' ? new Date(value) : null;
    if (d && !Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
    return String(value);
  }

  return String(value);
}

/** Parses raw user input (typed in an editor) into a typed cell value for the given column. */
export function parseCellInput(raw: string, columnType: ColumnDef['type']): CellValue {
  if (raw === '') return null;
  switch (columnType) {
    case 'number': {
      const normalized = raw.replace(/\./g, '').replace(',', '.');
      const num = Number(normalized.trim() === '' ? raw : normalized);
      return Number.isNaN(num) ? raw : num;
    }
    case 'boolean':
      return /^(true|verdadeiro|1|sim)$/i.test(raw.trim());
    case 'date': {
      const t = Date.parse(raw);
      return Number.isNaN(t) ? raw : new Date(t).toISOString();
    }
    default:
      return raw;
  }
}
