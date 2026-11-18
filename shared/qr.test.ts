import { describe, expect, it } from "vitest";

import { encodeQr, formatBits, qrPath, rsRemainder } from "./qr";

describe("Reed-Solomon", () => {
  it("matches the published 1-M vector for HELLO WORLD", () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
});

describe("the format word", () => {
  it("matches the standard's table for level M", () => {
    expect(formatBits(0).toString(2).padStart(15, "0")).toBe("101010000010010");
    expect(formatBits(1).toString(2).padStart(15, "0")).toBe("101000100100101");
    expect(formatBits(5).toString(2).padStart(15, "0")).toBe("100000011001110");
    expect(formatBits(7).toString(2).padStart(15, "0")).toBe("100101010100000");
  });
});

/** Read a symbol back the way a scanner does: format word, unmask, zigzag, header, bytes. */
function readBack(modules: boolean[][]): string {
  const size = modules.length;
  const version = (size - 17) / 4;
  let fmt = 0;
  for (let i = 0; i <= 5; i++) fmt |= (modules[i][8] ? 1 : 0) << i;
  fmt |= (modules[7][8] ? 1 : 0) << 6;
  fmt |= (modules[8][8] ? 1 : 0) << 7;
  fmt |= (modules[8][7] ? 1 : 0) << 8;
  for (let i = 9; i < 15; i++) fmt |= (modules[8][14 - i] ? 1 : 0) << i;
  let second = 0;
  for (let i = 0; i < 8; i++) second |= (modules[8][size - 1 - i] ? 1 : 0) << i;
  for (let i = 8; i < 15; i++) second |= (modules[size - 15 + i][8] ? 1 : 0) << i;
  expect(second).toBe(fmt);
  const mask = [0, 1, 2, 3, 4, 5, 6, 7].find((m) => formatBits(m) === fmt);
  expect(mask).toBeDefined();
  const fixed = (x: number, y: number) => {
    if ((x < 9 && y < 9) || (x < 9 && y >= size - 8) || (x >= size - 8 && y < 9)) return true;
    if (x === 6 || y === 6) return true;
    if (version >= 2) {
      const c = [0, 18, 22, 26, 30, 34][version - 1];
      if (Math.abs(x - c) <= 2 && Math.abs(y - c) <= 2) return true;
    }
    return false;
  };
  const hit = (x: number, y: number) => [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][mask as number];
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fixed(x, y)) bits.push((modules[y][x] !== hit(x, y)) ? 1 : 0);
      }
  }
  const take = (from: number, n: number) => bits.slice(from, from + n).reduce((a, b) => (a << 1) | b, 0);
  // One block only for versions 1 to 3, so the data codewords are in order.
  expect(take(0, 4)).toBe(0b0100);
  const len = take(4, 8);
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(take(12 + i * 8, 8));
  return new TextDecoder().decode(Uint8Array.from(out));
}

describe("a symbol", () => {
  it("encodes a door address that reads back the same, with matching format copies", () => {
    const text = "https://village.example/door/k7m2pq9xra";
    const qr = encodeQr(text);
    expect(qr).not.toBeNull();
    if (!qr) return;
    expect(qr.version).toBe(3);
    expect(qr.size).toBe(29);
    expect(readBack(qr.modules)).toBe(text);
  });

  it("draws the three finders and the timing line", () => {
    const qr = encodeQr("hello");
    if (!qr) throw new Error("no symbol");
    const m = qr.modules;
    for (const [x, y] of [[0, 0], [qr.size - 7, 0], [0, qr.size - 7]]) {
      expect(m[y][x]).toBe(true);
      expect(m[y + 1][x + 1]).toBe(false);
      expect(m[y + 3][x + 3]).toBe(true);
    }
    for (let i = 8; i < qr.size - 8; i++) expect(m[6][i]).toBe(i % 2 === 0);
    expect(m[qr.size - 8][8]).toBe(true);
  });

  it("grows a version for longer text and refuses past its reach", () => {
    expect(encodeQr("x".repeat(60))?.version).toBe(4);
    expect(encodeQr("x".repeat(106))?.version).toBe(6);
    expect(encodeQr("x".repeat(107))).toBeNull();
    expect(encodeQr("")).toBeNull();
  });

  it("draws one path inside a quiet zone", () => {
    const qr = encodeQr("a");
    if (!qr) throw new Error("no symbol");
    expect(qrPath(qr.modules).startsWith("M4 4h1v1h-1z")).toBe(true);
  });
});
