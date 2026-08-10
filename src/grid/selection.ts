import type { SelectionRange } from '../model/types';

export interface Rect {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

export function normalizeRange(sel: SelectionRange): Rect {
  return {
    rowStart: Math.min(sel.anchor.rowIdx, sel.focus.rowIdx),
    rowEnd: Math.max(sel.anchor.rowIdx, sel.focus.rowIdx),
    colStart: Math.min(sel.anchor.colIdx, sel.focus.colIdx),
    colEnd: Math.max(sel.anchor.colIdx, sel.focus.colIdx),
  };
}

export function isWithin(rect: Rect, rowIdx: number, colIdx: number): boolean {
  return rowIdx >= rect.rowStart && rowIdx <= rect.rowEnd && colIdx >= rect.colStart && colIdx <= rect.colEnd;
}
