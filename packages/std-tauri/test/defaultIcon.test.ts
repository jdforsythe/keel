// The default Tauri icon: a valid 256 x 256 RGBA PNG of Keel's mark in the brand's colors.
import { readFileSync } from "node:fs";
import path from "node:path";
import { crc32, inflateSync } from "node:zlib";
import { repoRoot } from "@keel/tooling/repo-root";
import { describe, expect, test } from "vitest";
import { defaultIcon } from "../src/tools/defaultIcon.ts";

const repo = repoRoot(import.meta.dirname);
const mark = readFileSync(path.join(repo, "docs", "brand", "keel-mark.svg"), "utf8");
const tokens = readFileSync(path.join(repo, "packages", "ui", "src", "brand", "brandTokens.ts"), "utf8");
const token = (name: string): string =>
  (new RegExp(`\\b${name}: "(#[0-9a-fA-F]{6})"`).exec(tokens)?.[1] ?? "").toLowerCase();

/** The chunks of a PNG, each CRC checked. */
function chunks(png: Buffer): { type: string; data: Buffer }[] {
  const out: { type: string; data: Buffer }[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const body = png.subarray(at + 4, at + 8 + length);
    expect(png.readUInt32BE(at + 8 + length)).toBe(crc32(body));
    out.push({ type: body.subarray(0, 4).toString("latin1"), data: body.subarray(4) });
    at += 12 + length;
  }
  return out;
}

describe("defaultIcon", () => {
  const png = defaultIcon();
  const parts = chunks(png);
  const raw = inflateSync(parts[1]?.data ?? Buffer.alloc(0));
  /** The color at a point of the mark's viewBox, as `#rrggbb`; the alpha is checked full. */
  const at = (vx: number, vy: number): string => {
    const x = Math.floor(((vx + 127) * 256) / 680);
    const y = Math.floor(((vy + 100) * 256) / 680);
    const i = y * 1025 + 1 + x * 4;
    expect(raw[i + 3]).toBe(255);
    return `#${raw.subarray(i, i + 3).toString("hex")}`;
  };

  test("is a PNG of 256 x 256 RGBA pixels, 8 bits a channel, with valid chunks", () => {
    expect(png.subarray(0, 8).toString("latin1")).toBe("\x89PNG\r\n\x1a\n");
    expect(parts.map((p) => p.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    const head = parts[0]?.data ?? Buffer.alloc(0);
    expect([head.readUInt32BE(0), head.readUInt32BE(4), ...head.subarray(8)]).toEqual([256, 256, 8, 6, 0, 0, 0]);
    expect(raw.length).toBe(256 * 1025);
    for (let y = 0; y < 256; y++) expect(raw[y * 1025]).toBe(0);
  });

  test("is small and the same bytes on every call", () => {
    expect(png.length).toBeLessThan(4096);
    expect(defaultIcon().equals(png)).toBe(true);
  });

  test("uses only the brand's surface, text and accent, the colors of the mark", () => {
    const seen = new Set<string>();
    for (let i = 0; i < raw.length; i += 1025)
      for (let x = 1; x < 1025; x += 4) seen.add(`#${raw.subarray(i + x, i + x + 3).toString("hex")}`);
    const colors = [token("surface"), token("text"), token("accent")];
    expect(colors.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    expect([...seen].sort()).toEqual([...colors].sort());
    expect(mark).toContain(`fill="${token("text")}"`);
    expect(mark).toContain(`fill="${token("accent")}"`);
  });

  test("draws the mark: the accent bar over the crossbar, the brackets and the stub in text, surface around", () => {
    const [surface, text, accent] = [token("surface"), token("text"), token("accent")];
    // The accent bar (`<rect x="178.2" width="67.97" height="479.32">`), full height and over the crossbar.
    expect(mark).toContain('x="178.2" width="67.97" height="479.32"');
    for (const vy of [4, 240, 475]) expect(at(212, vy)).toBe(accent);
    expect(at(212, -6)).toBe(surface);
    expect(at(212, 485)).toBe(surface);
    // The left bracket's spine and arms, the crossbar's two parts, the right corners.
    for (const [vx, vy] of [
      [98, 240],
      [150, 130],
      [150, 350],
      [28, 242],
      [160, 242],
      [400, 242],
      [280, 130],
      [328, 180],
      [280, 350],
      [328, 300],
    ])
      expect(at(vx ?? 0, vy ?? 0), `${vx},${vy}`).toBe(text);
    // Inside the bracket, between the corners, and the margin.
    for (const [vx, vy] of [
      [150, 190],
      [328, 212],
      [328, 274],
      [65, 242],
      [280, 180],
      [-100, -80],
      [520, 560],
    ])
      expect(at(vx ?? 0, vy ?? 0), `${vx},${vy}`).toBe(surface);
  });
});
