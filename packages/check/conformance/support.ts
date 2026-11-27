// Shared helpers for the check conformance suite (not a test file). Public API only.
// Seed 1337 for every property in this suite.
import { type Dirent, readdirSync } from "node:fs";
import type { check } from "@keel/check";
import { defineTokens } from "@keel/ui/tokens";

export const SEED = 1337;
export type Files = Parameters<typeof check>[0];

export const one = (source: string, path = "C.tsx"): Files => [{ path, source }];

const FOR_HEAD = `
import { For } from '@keel/runtime-dom'
import { s } from '@keel/schema'
export const Props = s.object({ items: s.array(s.object({ id: s.string(), name: s.string() })) })
`;

export interface Fixture {
  code: string;
  bad: string;
  clean: string;
}

const UI = `import { Box, Text, Heading, Button, Link, Image } from '@keel/ui'\n`;

/** Compiler and component codes, each with a triggering fixture and a clean counterpart. Base elements only (no E1805). */
export const FIXTURES: Fixture[] = [
  {
    code: "E1001",
    bad: `${UI}${FOR_HEAD}export default function C(props) { return <Box as="ul"><For each={props.items}>{(i) => <Box as="li">{i.name}</Box>}</For></Box> }`,
    clean: `${UI}${FOR_HEAD}export default function C(props) { return <Box as="ul"><For each={props.items} key="id">{(i) => <Box as="li">{i.name}</Box>}</For></Box> }`,
  },
  {
    code: "E1003",
    bad: `${UI}export default function C() { return <Image src="javascript:alert(1)" alt="x" /> }`,
    clean: `${UI}export default function C() { return <Image alt="x" /> }`,
  },
  {
    code: "E1401",
    bad: `${UI}export default function C({ name }) { return <Text>{name}</Text> }`,
    clean: `${UI}export default function C(props) { return <Text>{props.name}</Text> }`,
  },
  {
    code: "E1403",
    bad: `${UI}export default function C(props) { return <Box as="section">{props.a && <Text>x</Text>}</Box> }`,
    clean: `${UI}import { If } from '@keel/runtime-dom'
export default function C(props) { return <Box as="section"><If when={props.a}><Text>x</Text></If></Box> }`,
  },
  {
    code: "E1404",
    bad: `${UI}export default function C() { return <Box as="section"><Box id="x">1</Box><Box id="x">2</Box></Box> }`,
    clean: `${UI}export default function C() { return <Box as="section"><Box id="x">1</Box><Box id="y">2</Box></Box> }`,
  },
];

/** Codes from a registry value that may be an array of rules, a Map, or a record keyed by code. */
export function registryCodes(reg: unknown): string[] {
  if (reg instanceof Map) return Array.from(reg.keys()).filter((k): k is string => typeof k === "string");
  if (Array.isArray(reg)) {
    const out: string[] = [];
    for (const r of reg) {
      if (typeof r === "string") out.push(r);
      else if (typeof r === "object" && r !== null && "code" in r && typeof r.code === "string") out.push(r.code);
    }
    return out;
  }
  if (typeof reg === "object" && reg !== null) return Object.keys(reg);
  return [];
}

export function registryEntry(reg: unknown, code: string): unknown {
  if (reg instanceof Map) return reg.get(code);
  if (Array.isArray(reg)) {
    return reg.find((r) => typeof r === "object" && r !== null && "code" in r && r.code === code);
  }
  if (typeof reg === "object" && reg !== null) return Reflect.get(reg, code);
  return undefined;
}

export function sourceOf(file: unknown): string {
  return typeof file === "object" && file !== null && "source" in file && typeof file.source === "string"
    ? file.source
    : "";
}

export function pathOf(file: unknown): string {
  return typeof file === "object" && file !== null && "path" in file && typeof file.path === "string" ? file.path : "";
}

/** Findings for each occurrence of `needle`, 1-based line and col. */
export function findAll(file: unknown, needle: string): { path: string; line: number; col: number }[] {
  const out: { path: string; line: number; col: number }[] = [];
  const lines = sourceOf(file).split("\n");
  lines.forEach((text, i) => {
    let from = 0;
    for (;;) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      out.push({ path: pathOf(file), line: i + 1, col: at + 1 });
      from = at + needle.length;
    }
  });
  return out;
}

export interface Diag {
  kind: "diag";
  code: string;
  path: string;
  line: number;
  col: number;
  message: string;
  fix?: string;
}

export function synth(code: string, i: number, path = `src/f${i}.tsx`, fix?: string): Diag {
  const base: Diag = {
    kind: "diag",
    code,
    path,
    line: i + 1,
    col: 3,
    message: `synthetic ${code} finding number ${i}`,
  };
  return fix === undefined ? base : { ...base, fix };
}

export const approxTokens = (s: string): number => Math.ceil(s.length / 4);
export const lines = (s: string): string[] => s.split("\n").filter((l) => l !== "");

/**
 * The `.ts`/`.tsx` paths under `dir`, relative and sorted. Symlinks, `node_modules` and dot entries are skipped: a
 * std-sessions disk fixture (`conformance/.tmp-<pid>-<n>/node_modules/@keel/std-sessions`) links back to its own
 * package, and following it (as `readdirSync({ recursive: true })` does) walks every copy inside every copy until the
 * heap runs out. A missing `dir` is empty; any other error throws.
 */
export function sourceFilesUnder(dir: URL): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(new URL(rel, dir), { withFileTypes: true });
    } catch (e) {
      if (rel === "" && e instanceof Error && "code" in e && (e.code === "ENOENT" || e.code === "ENOTDIR")) return;
      throw e;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      if (e.isDirectory()) walk(`${rel}${e.name}/`);
      else if (e.isFile() && /\.tsx?$/.test(e.name)) out.push(`${rel}${e.name}`);
    }
  };
  walk("");
  return out.sort();
}

/** Tokens written as plain data, so a group `Tokens` does not name yet (`themes`, `overlay`) type-checks before the build; the same pattern as ui's `withGroups`. */
export const looseTokens = (plain: unknown) => defineTokens(JSON.parse(JSON.stringify(plain)));

/** The `#rrggbb` channels of a hex color. */
const channelsOf = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = (c: number, knee: number): number => {
  const a = Math.abs(c);
  return Math.sign(c) * (a <= knee ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4);
};
const words = (color: string): number[] =>
  (/\(([^)]*)\)/.exec(color)?.[1] ?? "")
    .replace("display-p3", "")
    .trim()
    .split(/\s+/)
    .map((w) => (w.endsWith("%") ? Number.parseFloat(w) / 100 : Number.parseFloat(w)));
const oklab = (L: number, a: number, b: number): [number, number, number] => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
/** Linear sRGB channels of a `<color>` as given, from the formulas of k.values Contrast (not gamut-mapped). */
export const linearOf = (color: string): [number, number, number] => {
  const [x = 0, y = 0, z = 0] = color.startsWith("#") ? channelsOf(color) : words(color);
  if (color.startsWith("#") || color.startsWith("rgb("))
    return [lin(x / 255, 0.03928), lin(y / 255, 0.03928), lin(z / 255, 0.03928)];
  if (color.startsWith("hsl(")) {
    const h = ((x % 360) + 360) % 360;
    const f = (n: number): number => {
      const k = (n + h / 30) % 12;
      return z - y * Math.min(z, 1 - z) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [lin(f(0), 0.03928), lin(f(8), 0.03928), lin(f(4), 0.03928)];
  }
  if (color.startsWith("oklab(")) return oklab(x, y, z);
  if (color.startsWith("oklch(")) return oklab(x, y * Math.cos((z * Math.PI) / 180), y * Math.sin((z * Math.PI) / 180));
  const [pr, pg, pb] = [lin(x, 0.04045), lin(y, 0.04045), lin(z, 0.04045)];
  return [
    1.2249401 * pr - 0.2249404 * pg,
    -0.0420569 * pr + 1.0420571 * pg,
    -0.0196376 * pr - 0.0786361 * pg + 1.0982735 * pb,
  ];
};
/** Whether the color is inside sRGB: no linear channel out of 0..1 by more than 0.000001. */
export const insideSrgb = (color: string): boolean => linearOf(color).every((c) => c >= -0.000001 && c <= 1.000001);
/** `0.2126 R + 0.7152 G + 0.0722 B` of the color as given, clamped to 0..1. */
export const lumOf = (color: string): number => {
  const [r, g, b] = linearOf(color);
  return Math.min(1, Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b));
};
/** WCAG contrast ratio of two `<color>`s as given, two decimals as E1804 prints it. */
export const ratioOf = (a: string, b: string): string => {
  const [hi, lo] = [Math.max(lumOf(a), lumOf(b)), Math.min(lumOf(a), lumOf(b))];
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
};
/** `a x c + (1 - a) x b` on each encoded sRGB channel, as browsers blend (k.values Contrast): the `#rrggbb` of `rgb` over `backdrop`. */
export const blend = (rgb: [number, number, number], alpha: number, backdrop: string): string => {
  const back = channelsOf(backdrop);
  const mixed = rgb.map((c, i) => Math.round(alpha * c + (1 - alpha) * (back[i] ?? 0)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};
