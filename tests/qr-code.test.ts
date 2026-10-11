import assert from "node:assert/strict";
import { test } from "node:test";

import { drawQr, wrapCanvasText, createQrModules } from "../lib/qr-code";


// Read the version-1 symbol as a consumer: skip function patterns, remove mask 0,
// and recover the numeric payload and its seven error-correction codewords.
function readQrCodewords(modules: boolean[][]) {
  const bits: number[] = [];
  const columnPairs = [[20, 19], [18, 17], [16, 15], [14, 13], [12, 11], [10, 9], [8, 7], [5, 4], [3, 2], [1, 0]];
  columnPairs.forEach((columns, pairIndex) => {
    for (let index = 0; index < 21; index += 1) {
      const row = pairIndex % 2 === 0 ? 20 - index : index;
      for (const column of columns) {
        const isFunctionPattern = row === 6 || column === 6 ||
          (row <= 8 && column <= 8) || (row <= 8 && column >= 13) || (row >= 13 && column <= 8);
        if (!isFunctionPattern) bits.push(Number(modules[row][column] !== ((row + column) % 2 === 0)));
      }
    }
  });
  assert.equal(bits.length, 208);
  return Array.from({ length: 26 }, (_, index) => Number.parseInt(bits.slice(index * 8, index * 8 + 8).join(""), 2));
}

function decodeNumericPayload(codewords: number[]) {
  const bits = codewords.map((word) => word.toString(2).padStart(8, "0")).join("");
  let position = 0;
  const read = (length: number) => {
    const value = Number.parseInt(bits.slice(position, position + length), 2);
    position += length;
    return value;
  };
  assert.equal(read(4), 1, "numeric mode");
  const length = read(10);
  let digits = "";
  while (digits.length < length) {
    const count = Math.min(3, length - digits.length);
    digits += read(count === 3 ? 10 : count === 2 ? 7 : 4).toString().padStart(count, "0");
  }
  return digits;
}

// Evaluate the encoded polynomial at the seven Reed–Solomon roots using
// logarithm tables, independently of the encoder's bitwise multiplication.
function errorSyndromes(codewords: number[]) {
  const exponents: number[] = [];
  const logarithms: number[] = [];
  let value = 1;
  for (let power = 0; power < 255; power += 1) {
    exponents[power] = value;
    logarithms[value] = power;
    value <<= 1;
    if (value >= 256) value ^= 0x11d;
  }
  const multiply = (left: number, right: number) => left && right ? exponents[(logarithms[left] + logarithms[right]) % 255] : 0;
  return Array.from({ length: 7 }, (_, power) => codewords.reduce((sum, word) => multiply(sum, exponents[power]) ^ word, 0));
}

test("QR symbols decode the existing padded, digit-only, eight-character references", () => {
  for (const [input, expected] of [
    ["00123456", "00123456"], ["42", "00000042"],
    ["student-12 3456789", "12345678"], ["letters only", "00000000"], ["", "00000000"],
  ]) {
    assert.equal(decodeNumericPayload(readQrCodewords(createQrModules(input))), expected);
  }
});

test("version-1 finder, separator and timing patterns retain their geometry", () => {
  const modules = createQrModules("12345678");
  assert.equal(modules.length, 21);
  assert.ok(modules.every((row) => row.length === 21 && row.every((value) => typeof value === "boolean")));
  for (const [rowOffset, columnOffset] of [[0, 0], [0, 14], [14, 0]]) {
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const dark = row === 0 || row === 6 || column === 0 || column === 6 ||
          (row >= 2 && row <= 4 && column >= 2 && column <= 4);
        assert.equal(modules[rowOffset + row][columnOffset + column], dark);
      }
    }
  }
  assert.deepEqual(modules[7].slice(0, 8), Array(8).fill(false));
  for (let index = 8; index <= 12; index += 1) {
    assert.equal(modules[6][index], index % 2 === 0);
    assert.equal(modules[index][6], index % 2 === 0);
  }
});

test("QR error correction validates intact codewords and detects corrupted data", () => {
  for (const input of ["00000000", "12345678", "87654321"]) {
    const codewords = readQrCodewords(createQrModules(input));
    assert.deepEqual(errorSyndromes(codewords), Array(7).fill(0));
    codewords[0] ^= 1;
    assert.ok(errorSyndromes(codewords).some((value) => value !== 0));
  }
});

test("canvas QR drawing retains colors, scale and the four-module quiet zone", () => {
  const rectangles: Array<{ color: string; coordinates: number[] }> = [];
  const context = {
    fillStyle: "",
    fillRect(...coordinates: number[]) { rectangles.push({ color: this.fillStyle, coordinates }); },
  };
  drawQr(context as unknown as CanvasRenderingContext2D, "12345678", 10, 20, 290);
  assert.deepEqual(rectangles[0], { color: "#ffffff", coordinates: [10, 20, 290, 290] });
  assert.deepEqual(rectangles[1], { color: "#111827", coordinates: [50, 60, 10, 10] });
  assert.ok(rectangles.slice(1).every(({ color, coordinates: [x, y, width, height] }) =>
    color === "#111827" && x >= 50 && y >= 60 && x + width <= 260 && y + height <= 270
  ));
});

test("canvas text wraps on measured word boundaries and retains long single words", () => {
  const lines: Array<[string, number, number]> = [];
  const context = {
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText: (text: string, x: number, y: number) => lines.push([text, x, y]),
  } as unknown as CanvasRenderingContext2D;
  wrapCanvasText(context, "one two three", 10, 20, 50, 8);
  assert.deepEqual(lines, [["one", 10, 20], ["two", 10, 28], ["three", 10, 36]]);
  lines.length = 0;
  wrapCanvasText(context, "longword", 10, 20, 50, 8);
  wrapCanvasText(context, "", 10, 20, 50, 8);
  assert.deepEqual(lines, [["longword", 10, 20]]);
});
