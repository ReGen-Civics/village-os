/**
 * A QR CODE, drawn here with no dependency: byte mode, error correction level
 * M, versions 1 to 6 (up to 106 bytes, enough for any address and a door
 * code). Printed on paper and scanned by a phone camera, so it follows the
 * standard (ISO/IEC 18004) exactly: Reed-Solomon over GF(256) with the 0x11D
 * field, the M block layout per version, the zigzag placement, all eight
 * masks scored by the four penalty rules, and the 15-bit format word.
 *
 * Returns a square of booleans (true = dark), without the quiet zone; the
 * drawing adds four modules of light around it.
 */

/** Data codewords per block and blocks, for level M, versions 1 to 6. */
const M_BLOCKS: ReadonlyArray<{ ec: number; blocks: number; data: number }> = [
  { ec: 10, blocks: 1, data: 16 },
  { ec: 16, blocks: 1, data: 28 },
  { ec: 26, blocks: 1, data: 44 },
  { ec: 18, blocks: 2, data: 32 },
  { ec: 24, blocks: 2, data: 43 },
  { ec: 16, blocks: 4, data: 27 },
];
/** The centre of the one alignment pattern, versions 2 to 6. */
const ALIGN: ReadonlyArray<number> = [0, 18, 22, 26, 30, 34];
/** Level M's two format bits. */
const FORMAT_M = 0;

export const QR_MAX_BYTES = 106;

// ── GF(256) and Reed-Solomon ───────────────────────────────────────────────

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

/** The error correction codewords for one block. Exported for the published test vector. */
export function rsRemainder(data: readonly number[], degree: number): number[] {
  const divisor = rsDivisor(degree);
  const result = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

/** The 15-bit format word for level M and a mask, BCH-coded and XORed per the standard. */
export function formatBits(mask: number): number {
  const data = (FORMAT_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

// ── Building the symbol ────────────────────────────────────────────────────

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function dataCodewords(bytes: number[], version: number): number[] {
  const { blocks, data } = M_BLOCKS[version - 1];
  const capacity = blocks * data;
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity * 8 - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < capacity; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

function interleave(codewords: number[], version: number): number[] {
  const { ec, blocks, data } = M_BLOCKS[version - 1];
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  for (let b = 0; b < blocks; b++) {
    const d = codewords.slice(b * data, (b + 1) * data);
    dataBlocks.push(d);
    ecBlocks.push(rsRemainder(d, ec));
  }
  const out: number[] = [];
  for (let i = 0; i < data; i++) for (const d of dataBlocks) out.push(d[i]);
  for (let i = 0; i < ec; i++) for (const e of ecBlocks) out.push(e[i]);
  return out;
}

type Grid = boolean[][];

function functionPatterns(version: number): { modules: Grid; fixed: Grid } {
  const size = version * 4 + 17;
  const modules: Grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed: Grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    fixed[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  if (version >= 2) {
    const c = ALIGN[version - 1];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // Reserve the format areas (written for real once the mask is chosen) and the dark module.
  for (let i = 0; i <= 8; i++) {
    fixed[8][i] = true;
    fixed[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    fixed[8][size - 1 - i] = true;
    fixed[size - 1 - i][8] = true;
  }
  set(8, size - 8, true);
  return { modules, fixed };
}

function placeData(modules: Grid, fixed: Grid, codewords: number[]): void {
  const size = modules.length;
  let i = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fixed[y][x] && i < total) {
          modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }
}

function maskHit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(modules: Grid, fixed: Grid, mask: number): void {
  const size = modules.length;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && maskHit(mask, x, y)) modules[y][x] = !modules[y][x];
}

function drawFormat(modules: Grid, mask: number): void {
  const size = modules.length;
  const bits = formatBits(mask);
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) modules[i][8] = bit(i);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let i = 9; i < 15; i++) modules[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = bit(i);
  modules[size - 8][8] = true;
}

/** The standard's penalty score; the lowest-scoring mask is the one printed. */
export function penalty(modules: Grid): number {
  const size = modules.length;
  let score = 0;
  const runs = (line: boolean[]) => {
    let s = 0;
    let run = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) s += 3 + (run - 5);
        run = 1;
      }
    }
    return s;
  };
  const finderLike = (line: boolean[]) => {
    let s = 0;
    const p1 = [true, false, true, true, true, false, true, false, false, false, false];
    const p2 = [false, false, false, false, true, false, true, true, true, false, true];
    for (let i = 0; i + 11 <= line.length; i++) {
      const seg = line.slice(i, i + 11);
      if (seg.every((v, k) => v === p1[k]) || seg.every((v, k) => v === p2[k])) s += 40;
    }
    return s;
  };
  for (let y = 0; y < size; y++) {
    const row = modules[y];
    const col = modules.map((r) => r[y]);
    score += runs(row) + runs(col) + finderLike(row) + finderLike(col);
  }
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
  let dark = 0;
  for (const row of modules) for (const v of row) if (v) dark++;
  const k = Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size));
  score += k * 10;
  return score;
}

/** Encode `text` as a QR code, or null when it is longer than this encoder holds. */
export function encodeQr(text: string): { size: number; modules: Grid; version: number; mask: number } | null {
  const bytes = utf8(text);
  if (bytes.length === 0 || bytes.length > QR_MAX_BYTES) return null;
  let version = 1;
  while (version <= 6) {
    const { blocks, data } = M_BLOCKS[version - 1];
    if (bytes.length * 8 + 12 <= blocks * data * 8) break;
    version++;
  }
  if (version > 6) return null;
  const codewords = interleave(dataCodewords(bytes, version), version);
  let best: { modules: Grid; mask: number; score: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const { modules, fixed } = functionPatterns(version);
    placeData(modules, fixed, codewords);
    applyMask(modules, fixed, mask);
    drawFormat(modules, mask);
    const score = penalty(modules);
    if (!best || score < best.score) best = { modules, mask, score };
  }
  const chosen = best as { modules: Grid; mask: number };
  return { size: chosen.modules.length, modules: chosen.modules, version, mask: chosen.mask };
}

/** One SVG path of the dark modules, offset by a four-module quiet zone. */
export function qrPath(modules: Grid): string {
  let d = "";
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    }),
  );
  return d;
}
