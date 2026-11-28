import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, normalize } from "node:path";
// Spec: k.derived, clause "In the copy of clause 1, after one `keel check`, a second with no file changed has json `counts.evaluated` 0 and `counts.cached` 1."
// Spec: k.derived, clause "In that copy after one `keel check`, editing `test/` files only gives `counts.evaluated` 0, and editing the contract gives `counts.evaluated` 1."
// Spec: k.derived, clause "After the contract edit of clause 23, the one entry written in `node_modules/.cache/keel/derived/` has `inputs` holding the contract, `routes.ts` and each project file `routes.ts` imports, directly or through others, no test file, and only paths that exist."
// Spec: k.derived, clause "In that copy with `node_modules/.cache` removed and `node_modules` kept, `keel check` has `counts.evaluated` 1 and `counts.cached` 0."
// Seed 1337 n/a: fixed edits. The real binary over a copy of `examples/client-only-api` after clause 1's edit (derived-support.ts `addRoute`); the work is read from the
// json summary's `counts` (`evaluated`, `cached`) and from the entries of `node_modules/.cache/keel/derived/`. No duration is asserted (k.derived Work).
// ASSUMED (the spec names `inputs` and says each holds a path and a SHA-256, not the entry's JSON layout): an entry is one JSON file whose `inputs` is an array of paths or of objects with a
// `path`, or an object keyed by path; a project file's path is relative to the project and another's is `<package name>/<path in the package>`.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Tree, addRoute, apiTree, brief, cloneTree, dropTree, keel, put, read } from "./derived-support.ts";

const SLOW = fixedTime(600_000);
const CONTRACT = "modules/app/app.contract.ts";
const ROUTES = "modules/app/routes.ts";
const CACHE = "node_modules/.cache/keel/derived";

let base: Tree;
const made: Tree[] = [];
beforeAll(() => {
  base = apiTree();
}, SLOW);
afterAll(() => {
  dropTree(base);
  for (const t of made) dropTree(t);
});

/** The copy of clause 1 after one `keel check`. */
function checked(): Tree {
  const t = cloneTree(base);
  made.push(t);
  addRoute(t.dir);
  const first = keel(t.dir, ["check"]);
  if (first.status !== 0) throw new Error(`first check failed: ${brief(first)}`);
  return t;
}

const entries = (dir: string): string[] => (existsSync(join(dir, CACHE)) ? readdirSync(join(dir, CACHE)).sort() : []);

/** The paths an entry's `inputs` hold. */
function inputPaths(file: string): string[] {
  const v: unknown = JSON.parse(readFileSync(file, "utf8"));
  const inputs: unknown = typeof v === "object" && v !== null ? Reflect.get(v, "inputs") : undefined;
  if (Array.isArray(inputs)) {
    return inputs.flatMap((i: unknown) => {
      if (typeof i === "string") return [i];
      const p: unknown = typeof i === "object" && i !== null ? Reflect.get(i, "path") : undefined;
      return typeof p === "string" ? [p] : [];
    });
  }
  return typeof inputs === "object" && inputs !== null ? Object.keys(inputs) : [];
}

/** `from` and the project files it imports, directly or through others, by relative specifiers. */
function closure(dir: string, from: string): string[] {
  const seen = new Set<string>();
  const walk = (rel: string): void => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const text = read(dir, rel);
    for (const m of text.matchAll(/(?:from|import)\s+["'](\.[^"']+)["']/g))
      walk(normalize(join(dirname(rel), m[1] ?? "")));
  };
  walk(from);
  return [...seen].sort();
}

/** True when `p` is a file of the project, of a package under `node_modules` (`<name>/<path>`, a scoped name has two segments), or another's absolute path (k.derived Derivation cache). */
function exists(dir: string, p: string): boolean {
  if (isAbsolute(p)) return existsSync(p);
  if (existsSync(join(dir, p))) return true;
  const parts = p.split("/");
  const name = p.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? "");
  const rest = parts.slice(p.startsWith("@") ? 2 : 1).join("/");
  return existsSync(join(dir, "node_modules", name, rest));
}

describe("k.derived Work", () => {
  test(
    "In the copy of clause 1, after one `keel check`, a second with no file changed has json `counts.evaluated` 0 and `counts.cached` 1.",
    () => {
      const t = checked();
      const out = keel(t.dir, ["check"]);
      expect(out.status, brief(out)).toBe(0);
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
    },
    SLOW,
  );

  test(
    "In that copy after one `keel check`, editing `test/` files only gives `counts.evaluated` 0, and editing the contract gives `counts.evaluated` 1.",
    () => {
      const t = checked();
      put(t.dir, "test/clientOnly.test.ts", `${read(t.dir, "test/clientOnly.test.ts")}// edit\n`);
      const tests = keel(t.dir, ["check"]);
      expect(tests.counts.evaluated, brief(tests)).toBe(0);
      put(t.dir, CONTRACT, `${read(t.dir, CONTRACT)}// edit\n`);
      const contract = keel(t.dir, ["check"]);
      expect(contract.counts.evaluated, brief(contract)).toBe(1);
    },
    SLOW,
  );

  test(
    "After the contract edit of clause 23, the one entry written in `node_modules/.cache/keel/derived/` has `inputs` holding the contract, `routes.ts` and each project file `routes.ts` imports, directly or through others, no test file, and only paths that exist.",
    () => {
      const t = checked();
      const before = entries(t.dir);
      put(t.dir, CONTRACT, `${read(t.dir, CONTRACT)}// edit\n`);
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      const written = entries(t.dir).filter((e) => !before.includes(e));
      expect(written, "the one entry written").toHaveLength(1);
      const paths = inputPaths(join(t.dir, CACHE, written[0] ?? ""));
      for (const need of closure(t.dir, ROUTES)) expect(paths, `input ${need}`).toContain(need);
      expect(paths).toContain(CONTRACT);
      expect(paths.filter((p) => p.startsWith("test/"))).toEqual([]);
      expect(paths.filter((p) => !exists(t.dir, p))).toEqual([]);
    },
    SLOW,
  );

  test(
    "In that copy with `node_modules/.cache` removed and `node_modules` kept, `keel check` has `counts.evaluated` 1 and `counts.cached` 0.",
    () => {
      const t = checked();
      rmSync(join(t.dir, "node_modules/.cache"), { recursive: true, force: true });
      const out = keel(t.dir, ["check"]);
      expect(out.status, brief(out)).toBe(0);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
    },
    SLOW,
  );
});
