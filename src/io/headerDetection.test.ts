import { describe, expect, it } from 'vitest';
import { detectHeaderRow } from './headerDetection';

describe('detectHeaderRow', () => {
  it('skips blank leading rows to find the header', () => {
    const rows = [
      [null, null, null],
      [null, null, null],
      ['Nome', 'Idade', 'Ativo'],
      ['Ana', 30, true],
      ['Bruno', 41, false],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it('skips a title row followed by a blank row', () => {
    const rows = [
      ['Relatório de Vendas', null, null],
      [null, null, null],
      ['Nome', 'Idade', 'Ativo'],
      ['Ana', 30, true],
      ['Bruno', 41, false],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it('defaults to the first non-blank row when there is nothing to disambiguate', () => {
    const rows = [
      ['Nome', 'Idade'],
      ['Ana', 30],
      ['Bruno', 41],
    ];
    expect(detectHeaderRow(rows)).toBe(0);
  });

  it('tolerates a blank cell in the header row itself', () => {
    const rows = [
      ['Nome', ''],
      ['Ana', '10'],
      ['Bruno', ''],
    ];
    expect(detectHeaderRow(rows)).toBe(0);
  });

  it('returns 0 for empty input', () => {
    expect(detectHeaderRow([])).toBe(0);
  });
});
