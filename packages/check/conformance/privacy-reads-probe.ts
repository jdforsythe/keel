// Not a test file. Runs the three static privacy readers (k.privacy-reads) through a registered probe rule, so a test
// reaches them as a stdlib rule does: with the rule's `input`.
// Assumption: `input.ast` is a syntax tree whose nodes carry either `start`/`end` offsets or a `getText()` method, a call
// has `arguments` and a `callee` or `expression`; the probe finds the calls `probe(<expr>)` of a fixture and hands the
// readers each `<expr>` node, in source order.
// Assumption: the readers are exports of `@keel/check` not yet in its types, reached through `Reflect`.
import * as checkApi from "@keel/check";
import { check, defineRule } from "@keel/check";
import type { RuleInput } from "@keel/check";

export type Files = Parameters<typeof check>[0];
export type Names = { from: string; name: string }[];

const isObj = (v: unknown): v is object => typeof v === "object" && v !== null;
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

function walk(n: unknown, visit: (o: object) => void, seen: Set<object>): void {
  if (!isObj(n) || seen.has(n)) return;
  seen.add(n);
  if (Array.isArray(n)) {
    for (const x of n) walk(x, visit, seen);
    return;
  }
  visit(n);
  for (const k of Object.keys(n)) if (k !== "parent") walk(Reflect.get(n, k), visit, seen);
}

/** Start offset of a node, either syntax tree flavour. */
function startOf(n: object): number {
  const g: unknown = Reflect.get(n, "getStart");
  if (typeof g === "function") return num(Reflect.apply(g, n, [])) ?? -1;
  return num(Reflect.get(n, "start")) ?? -1;
}
/** Source text of a node. */
export function textOf(n: unknown, source: string): string {
  if (!isObj(n)) return "";
  const g: unknown = Reflect.get(n, "getText");
  if (typeof g === "function") {
    const t: unknown = Reflect.apply(g, n, []);
    return typeof t === "string" ? t : "";
  }
  const a = num(Reflect.get(n, "start"));
  const b = num(Reflect.get(n, "end"));
  return a === undefined || b === undefined ? "" : source.slice(a, b);
}

/** The first argument of every `probe(...)` call of the file, in source order. */
function probes(ast: unknown, source: string): object[] {
  const found: { at: number; node: object }[] = [];
  walk(
    ast,
    (o) => {
      const args: unknown = Reflect.get(o, "arguments");
      const callee: unknown = Reflect.get(o, "callee") ?? Reflect.get(o, "expression");
      if (!Array.isArray(args) || textOf(callee, source) !== "probe") return;
      const first: unknown = args[0];
      if (isObj(first)) found.push({ at: startOf(first), node: first });
    },
    new Set(),
  );
  return found.sort((a, b) => a.at - b.at).map((f) => f.node);
}

export type Hook = (input: RuleInput, nodes: object[]) => unknown;
let hook: Hook | undefined;
let results: { path: string; value: unknown }[] = [];
defineRule({
  code: "E2931",
  message: "privacy-reads probe",
  see: "k.privacy-reads",
  explain: "Calls the privacy readers a test names and records what they answer.",
  check: (input) => {
    if (hook) results.push({ path: input.file.path, value: hook(input, probes(input.ast, input.file.source)) });
    return [];
  },
});

/** Runs `h` on each file of the project and returns what it answered for `path`. */
export function run(files: Files, path: string, h: Hook): unknown {
  hook = h;
  results = [];
  try {
    check(files, { types: false });
    return results.find((r) => r.path === path)?.value;
  } finally {
    hook = undefined;
  }
}

/** A reader of `@keel/check` by name; throws while it is not exported. */
export function reader(name: string): (...args: unknown[]) => unknown {
  const f: unknown = Reflect.get(checkApi, name);
  if (typeof f !== "function") throw new Error(`${name} is not built`);
  return (...args) => Reflect.apply(f, checkApi, args);
}
