// Shared helpers for the `codemod place` conformance files (not a test file). Seed 1337.
// ASSUMED: `codemod place <module> --to <deployable> [--adapter <a>]` runs through the real `keel` binary (the `Op` union of
// `@keel/scaffold` does not name `place` yet); the project is built with the in-process generators, then written to a temp dir.
import { cleanup, keel, materialize, readTree } from "./keel-cli.ts";
import { type Files, apply } from "./fixtures.ts";

export { cleanup, keel, materialize, readTree };
export const SEED = 1337;

/** A project with `orders` and `catalog` on top of `app`, every module in one deployable. */
export function base(adapter?: string): Files {
  let files: Files = new Map();
  files = apply("project", adapter === undefined ? { name: "shop" } : { name: "shop", adapter }, files).files;
  files = apply("module", { id: "orders" }, files).files;
  files = apply("module", { id: "catalog" }, files).files;
  return files;
}

/** Names of the deployables declared in `topology.ts`. */
export function deployables(topology: string): string[] {
  return [...topology.matchAll(/^\s*(\w+):\s*\{\s*modules:/gm)].map((m) => m[1] ?? "").filter((n) => n !== "");
}

export const outside = (path: string): boolean =>
  !(path === "topology.ts" || path.startsWith("deploy/") || path.startsWith(".github/workflows/"));

/** Paths whose bytes differ between two trees (added, removed or changed). */
export function differing(a: Map<string, string>, b: Map<string, string>): string[] {
  const out = new Set<string>();
  for (const [p, v] of a) if (b.get(p) !== v) out.add(p);
  for (const p of b.keys()) if (!a.has(p)) out.add(p);
  return [...out].sort();
}
