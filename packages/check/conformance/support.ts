// Shared helpers for the check conformance suite (not a test file). Public API only.
// Seed 1337 for every property in this suite.
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

/** Compiler and component codes, each with a triggering fixture and a clean counterpart. */
export const FIXTURES: Fixture[] = [
  {
    code: "E1001",
    bad: `${FOR_HEAD}export default function C(props) { return <ul><For each={props.items}>{(i) => <li>{i.name}</li>}</For></ul> }`,
    clean: `${FOR_HEAD}export default function C(props) { return <ul><For each={props.items} key="id">{(i) => <li>{i.name}</li>}</For></ul> }`,
  },
  {
    code: "E1003",
    bad: `export default function C() { return <a href="javascript:alert(1)">x</a> }`,
    clean: `export default function C() { return <a href="https://example.com">x</a> }`,
  },
  {
    code: "E1401",
    bad: `export default function C({ name }) { return <p>{name}</p> }`,
    clean: `export default function C(props) { return <p>{props.name}</p> }`,
  },
  {
    code: "E1403",
    bad: `export default function C(props) { return <div>{props.a && <b/>}</div> }`,
    clean: `import { If } from '@keel/runtime-dom'
export default function C(props) { return <div><If when={props.a}><b/></If></div> }`,
  },
  {
    code: "E1404",
    bad: `export default function C() { return <div><a id="cart.x">1</a><b id="cart.x">2</b></div> }`,
    clean: `export default function C() { return <div><a id="cart.x">1</a><b id="cart.y">2</b></div> }`,
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
