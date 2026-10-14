// Port of skaraz-data/brand/living_mark.py (design system D369) to TypeScript.
// Same geometry and rules: each value becomes a column of square cells (one cell = `cell`
// index units); cells above the threshold are trigger cells in seasons that reach it; the
// threshold is a thin index line. 3 to 12 columns, at most `maxCells` cells tall (taller
// values are capped and the cap must be stated in the caption). Colours are not baked in:
// the component maps the three roles to the theme tokens (ink, trigger, index), which are
// the same values the Python generator hard-codes per theme.

export interface MarkRect { x: number; y: number; w: number; h: number; rx: number; role: 'ink' | 'trigger' }
export interface MarkGeometry { rects: MarkRect[]; lineY: number; capped: number[] }

/** Python 3 round(): ties go to the even integer. */
function pyRound(x: number): number {
    const f = Math.floor(x);
    const d = x - f;
    if (Math.abs(d - 0.5) < 1e-12) return f % 2 === 0 ? f : f + 1;
    return Math.round(x);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function livingMark(values: number[], cell: number, threshold: number, maxCells = 8): MarkGeometry {
    if (values.length < 3 || values.length > 12) throw new Error('living mark: give 3 to 12 values');
    const n = values.length;
    const rows = maxCells;
    const u = 100 / Math.max(n, rows);
    const g = u * 0.16;
    const x0 = (100 - n * u) / 2;
    const base = 100 - (100 - rows * u) / 2;
    const rects: MarkRect[] = [];
    const capped: number[] = [];
    values.forEach((v, k) => {
        const raw = Math.max(v > 0 ? 1 : 0, pyRound(v / cell));
        if (raw > rows) capped.push(k);
        const h = Math.min(rows, raw);
        for (let r = 0; r < h; r++) {
            const above = (r + 1) * cell > threshold + 1e-9 && v >= threshold;
            rects.push({
                x: r2(x0 + k * u + g / 2), y: r2(base - (r + 1) * u + g / 2),
                w: r2(u - g), h: r2(u - g), rx: r2(u * 0.12), role: above ? 'trigger' : 'ink',
            });
        }
    });
    const lineY = r2(base - Math.min(rows, threshold / cell) * u);
    return { rects, lineY, capped };
}
