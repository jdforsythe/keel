import { crc32, deflateSync } from "node:zlib";

const SIZE = 256;
/** `brandTokens` colors (`@keel/ui/brand`) as RGBA hex: `surface`, `text`, `accent`. */
const SURFACE = "f9f9f9ff";
const TEXT = "1a191eff";
const ACCENT = "b8420dff";
/** Keel's mark (`docs/brand/keel-mark.svg`) as rectangles in its viewBox units: `x0, y0, x1, y1, color`, later ones on top. */
const MARK: readonly (readonly [number, number, number, number, string])[] = [
  [73, 107, 122, 373, TEXT],
  [73, 107, 164, 155, TEXT],
  [73, 325, 164, 373, TEXT],
  [261, 107, 352, 155, TEXT],
  [303, 107, 352, 203, TEXT],
  [261, 325, 352, 373, TEXT],
  [303, 281, 352, 373, TEXT],
  [137, 218, 425, 267, TEXT],
  [0, 218, 58, 267, TEXT],
  [178, 0, 246, 479, ACCENT],
];
/** viewBox units per pixel: the icon shows a square of 680 units, the 425 x 479 mark centered in it. */
const UNIT = 680 / SIZE;

/** `n` as four bytes, big-endian. */
function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}

/** One PNG chunk: length, type, data, CRC of type and data. */
function chunk(type: string, data: Uint8Array): Buffer[] {
  const body = Buffer.concat([Buffer.from(type), data]);
  return [u32(data.length), body, u32(crc32(body))];
}

/**
 * The icon a Tauri shell build uses when the app has no `deploy/<name>/tauri/icons/icon.png` (k.shell Files): Keel's
 * mark on the brand surface, a 256 x 256 RGBA PNG, the same bytes on every call.
 */
export function defaultIcon(): Buffer {
  // Each row in hex: filter byte 0, then its pixels.
  let rows = "";
  for (let y = 0; y < SIZE; y++) {
    rows += "00";
    for (let x = 0; x < SIZE; x++) {
      const vx = (x + 0.5) * UNIT - 127;
      const vy = (y + 0.5) * UNIT - 100;
      let color = SURFACE;
      for (const [x0, y0, x1, y1, c] of MARK) if (vx >= x0 && vx < x1 && vy >= y0 && vy < y1) color = c;
      rows += color;
    }
  }
  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "latin1"),
    ...chunk("IHDR", Buffer.concat([u32(SIZE), u32(SIZE), Buffer.from([8, 6, 0, 0, 0])])),
    ...chunk("IDAT", deflateSync(Buffer.from(rows, "hex"))),
    ...chunk("IEND", Buffer.alloc(0)),
  ]);
}
