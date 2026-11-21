// E1758 host-zone and host-locale reads beyond the literal shapes: bound dates, local-time construction and
// parsing, a date's string forms, `toLocale*Case`, `.call` on a locale method, and an empty locale argument.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const e1758 = (src: string): string[] =>
  check([{ path: "modules/a/x.ts", source: src }], { types: false })
    .diagnostics.filter((d) => d.code === "E1758")
    .map((d) => d.message);
const fn = (body: string): string => `export function f(x: number, n: number, s: string, l: string) {\n${body}\n}\n`;

describe("E1758 host reads it reports", () => {
  it.each([
    ["a getter on a const bound to new Date", "const d = new Date(x)\nreturn d.getHours()"],
    ["a getter through a chain of consts", "const d = new Date(x)\nconst e = d\nreturn e.getMonth()"],
    ["the local-time constructor", "return new Date(2026, 0, 1)"],
    ["Date.parse of a date-time without an offset", "return Date.parse('2026-01-01T00:00')"],
    ["new Date of a date-time without an offset", "return new Date('2026-01-01T00:00')"],
    ["String of a date", "return String(new Date(x))"],
    ["a template holding a date", "return `${new Date(x)}`"],
    ["toString on a date", "return new Date(x).toString()"],
    ["toDateString on a bound date", "const d = new Date(x)\nreturn d.toDateString()"],
    ["toTimeString on a date", "return new Date(x).toTimeString()"],
    ["toLocaleUpperCase without a locale", "return s.toLocaleUpperCase()"],
    ["toLocaleLowerCase without a locale", "return s.toLocaleLowerCase()"],
    ["toLocaleString through .call", "return Number.prototype.toLocaleString.call(n)"],
    ["toLocaleString of void 0", "return n.toLocaleString(void 0)"],
    ["toLocaleString of an empty array", "return n.toLocaleString([])"],
    ["Intl constructor of an empty array", "return new Intl.NumberFormat([])"],
  ])("%s", (_, body) => {
    expect(e1758(fn(body))).toHaveLength(1);
  });
});

describe("E1758 reads it leaves alone", () => {
  it.each([
    ["toLocaleLowerCase with the route locale", "return s.toLocaleLowerCase(l)"],
    ["a UTC getter on a bound date", "const d = new Date(x)\nreturn d.getUTCHours()"],
    ["toISOString on a bound date", "const d = new Date(x)\nreturn d.toISOString()"],
    ["new Date of one epoch number", "return new Date(x).getTime()"],
    ["Date.parse of a date-only string", "return Date.parse('2026-01-01')"],
    ["Date.parse with a Z offset", "return Date.parse('2026-01-01T00:00Z')"],
    ["Date.parse with a numeric offset", "return Date.parse('2026-01-01T00:00+02:00')"],
    ["Date.parse of a value", "return Date.parse(s)"],
    ["Date.UTC of parts", "return new Date(Date.UTC(2026, 0, 1))"],
    ["toString on a number", "return n.toString()"],
    ["String of a number", "return String(n)"],
    ["a template of a string", "return `${s}!`"],
    [
      "a getter on a let reassigned to a non-date",
      "let d = new Date(x)\nd = { getHours: () => 1 }\nreturn d.getHours()",
    ],
    ["a locally declared Date", "class Date { getHours() { return 1 } }\nreturn new Date(2026, 0, 1).getHours()"],
    ["toLocaleString.call with a locale", "return Number.prototype.toLocaleString.call(n, l)"],
    ["toLocaleString of a locale array", "return n.toLocaleString([l])"],
  ])("%s", (_, body) => {
    expect(e1758(fn(body))).toEqual([]);
  });
});
