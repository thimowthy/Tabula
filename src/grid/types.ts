import type { CellValue } from '../model/types';

export type GridRow = { id: string } & Record<string, CellValue>;

export const ROW_NUM_KEY = '__rownum';
export const ROW_HEIGHT = 30;
export const HEADER_HEIGHT = 46;
