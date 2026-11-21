// Shared helpers for the check conformance suite (not a test file). Public API only.
// Seed 1337 for every property in this suite.
import { type Dirent, readdirSync } from "node:fs";
import type { check } from "@keel/check";

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
