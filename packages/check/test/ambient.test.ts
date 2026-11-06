import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const e1601 = (src: string): string[] =>
  check([{ path: "modules/app/a.ts", source: src }], { types: false })
    .diagnostics.filter((d) => d.code === "E1601")
    .map((d) => d.message);

const BAD: [string, string][] = [
  ["globalThis.Date.now()", "export const a = (): number => globalThis.Date.now();"],
  ["window.Date.now()", "export const a = (): number => window.Date.now();"],
  ["Date['now']()", "export const a = (): number => Date['now']();"],
  ["Math['random']()", "export const a = (): number => Math['random']();"],
  ["Date()", "export const a = (): string => Date();"],
  ["new Date()", "export const a = (): Date => new Date();"],
  ["performance.now", "export const a = (): number => performance.now();"],
  ["globalThis.performance.now", "export const a = (): number => globalThis.performance.now();"],
  ["crypto.getRandomValues", "export const a = (): unknown => crypto.getRandomValues(new Uint8Array(1));"],
  ["setTimeout", "export const a = (): unknown => setTimeout(() => 1, 5);"],
  ["setInterval", "export const a = (): unknown => globalThis.setInterval(() => 1, 5);"],
  ["requestAnimationFrame", "export const a = (): unknown => requestAnimationFrame(() => 1);"],
  ["fetch", "export const a = (): unknown => fetch('/x');"],
  ["new XMLHttpRequest", "export const a = (): unknown => new XMLHttpRequest();"],
  ["new WebSocket", "export const a = (): unknown => new WebSocket('ws://x');"],
  ["new EventSource", "export const a = (): unknown => new globalThis.EventSource('/x');"],
  ["localStorage", "export const a = (): unknown => localStorage.getItem('k');"],
  ["sessionStorage", "export const a = (): unknown => sessionStorage.getItem('k');"],
  ["indexedDB", "export const a = (): unknown => indexedDB.open('db');"],
  ["document.cookie", "export const a = (): string => document.cookie;"],
];

describe("E1601 ambient effects", () => {
  for (const [name, src] of BAD)
    it(`flags ${name}`, () => {
      expect(e1601(src)).toHaveLength(1);
    });

  it("does not flag a locally declared name or ctx use", () => {
    expect(e1601("const performance = { now: () => 1 };\nexport const a = (): number => performance.now();")).toEqual(
      [],
    );
    expect(e1601("export const a = (ctx: { clock: { now(): number } }): number => ctx.clock.now();")).toEqual([]);
    expect(e1601("export const a = (): Date => new Date(5);")).toEqual([]);
  });

  it("fixes map to the ctx equivalent where one is exact", () => {
    const fix = (src: string): string | undefined =>
      check([{ path: "modules/app/a.ts", source: src }], { types: false }).diagnostics.find((d) => d.code === "E1601")
        ?.fix;
    expect(fix("export const a = (): number => globalThis.Date.now();")).toContain(
      "+export const a = (): number => ctx.clock.now();",
    );
    expect(fix("export const a = (): number => Math['random']();")).toContain("ctx.random.float()");
    expect(fix("export const a = (): unknown => globalThis.fetch('/x');")).toContain("ctx.net.fetch('/x')");
    expect(fix("export const a = (): number => performance.now();")).toBeUndefined();
  });
});
