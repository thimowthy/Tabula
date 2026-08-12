/**
 * Best-effort guess at which row of an imported sheet is the header, instead
 * of always assuming row 0 — exported reports often have a title line and/or
 * a blank line above the real header. Mirrors the engine's
 * `detect_header_row` (engine/src/tabula_engine/io/detection.py) so imports
 * behave the same whether read by the app or by the reference engine.
 */

type TypeCategory = 'empty' | 'boolean' | 'date' | 'number' | 'text';

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

function isBlankRow(row: readonly unknown[]): boolean {
  return row.every(isBlank);
}

function typeCategory(v: unknown): TypeCategory {
  if (isBlank(v)) return 'empty';
  if (typeof v === 'boolean') return 'boolean';
  if (v instanceof Date) return 'date';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return 'number';
    return 'text';
  }
  return 'text';
}

/**
 * How much `candidate` looks like a header for the rows beneath it. A real
 * header is mostly filled in, and each column's label tends to be text even
 * when the data in that column below is typed (numbers, dates, booleans) —
 * that contrast is the main signal. A fully blank row can never be a header.
 * Missing individual cells (e.g. one unnamed column) are tolerated rather
 * than disqualifying, since that's a normal, already supported shape
 * (columns fall back to "Coluna N").
 */
function headerScore(candidate: readonly unknown[], sampleRows: readonly (readonly unknown[])[]): number {
  const filled = candidate.filter((v) => !isBlank(v));
  if (filled.length === 0) return -1;
  if (sampleRows.length === 0) return 0;

  let matches = 0;
  let considered = 0;
  for (let colIdx = 0; colIdx < candidate.length; colIdx++) {
    const candValue = candidate[colIdx];
    if (isBlank(candValue)) continue;

    const colValues = sampleRows.map((row) => row[colIdx]).filter((v) => !isBlank(v));
    if (colValues.length === 0) continue;
    considered++;

    const counts = new Map<TypeCategory, number>();
    for (const v of colValues) {
      const cat = typeCategory(v);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    let majority: TypeCategory = 'text';
    let majorityCount = -1;
    for (const [cat, count] of counts) {
      if (count > majorityCount) {
        majority = cat;
        majorityCount = count;
      }
    }
    if (typeCategory(candValue) !== majority) matches++;
  }

  const matchRatio = considered > 0 ? matches / considered : 0;
  const fillRatio = filled.length / candidate.length;
  return matchRatio * fillRatio;
}

/**
 * Skips fully blank leading rows, then scores nearby candidates (title rows,
 * the header itself, and the first couple of data rows) by how header-like
 * they look relative to a sample of the rows beneath them, and returns the
 * index of the top scorer. Ties favor the earliest row. Falls back to the
 * first non-blank row when nothing scores convincingly. Returns 0 for empty
 * input.
 */
export function detectHeaderRow(rows: readonly (readonly unknown[])[], window = 10, sampleSize = 10): number {
  const firstNonBlank = rows.findIndex((row) => !isBlankRow(row));
  if (firstNonBlank === -1) return 0;

  let bestIdx = firstNonBlank;
  let bestScore = -Infinity;
  const end = Math.min(firstNonBlank + window, rows.length);
  for (let idx = firstNonBlank; idx < end; idx++) {
    const sample = rows.slice(idx + 1, idx + 1 + sampleSize);
    const score = headerScore(rows[idx], sample);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }
  return bestIdx;
}
