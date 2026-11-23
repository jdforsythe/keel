// Shared by the service --base, route --no-loader and refresh conformance files. Not a test file.
// ASSUMED shapes: a service edit set names the same paths as k.scaffold's Service paragraph; the `keel scaffold`
// summary record is `{ kind: "summary", name: "scaffold <op>", counts: { created, changed, removed, artifacts? } }`.
import { expect } from "vitest";
import { type Files, apply, fresh } from "./fixtures.ts";
import { type CliRecord, keel } from "./keel-cli.ts";

export const ORIGIN = "https://api.example.com";
export const REASON = "order list";

/** The default project's `--adapter node` twin, holding modules `orders` and `catalog`. */
export function freshNode(): Files {
  let files: Files = new Map();
  files = apply("project", { name: "shop", adapter: "node" }, files).files;
  files = apply("module", { id: "orders" }, files).files;
  files = apply("module", { id: "catalog" }, files).files;
  return files;
}
export const withModuleNode = (id: string): Files => apply("module", { id }, freshNode()).files;
export const withModuleClient = (id: string): Files => apply("module", { id }, fresh()).files;

/** `package.json` `dependencies` as a plain record; fails when it is not one. */
export function dependencies(files: Files): Record<string, string> {
  const text = files.get("package.json");
  if (text === undefined) throw new Error("missing package.json");
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || !("dependencies" in parsed)) throw new Error("no dependencies");
  const deps = parsed.dependencies;
  if (typeof deps !== "object" || deps === null) throw new Error("dependencies is not an object");
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(deps)) {
    if (typeof v !== "string") throw new Error(`dependency ${k} is not a string`);
    out[k] = v;
  }
  return out;
}

/** The source with whitespace outside strings dropped, quotes as `"` and trailing commas removed. */
export function squash(src: string): string {
  let out = "";
  let inStr = false;
  for (const ch of src.replaceAll("'", '"')) {
    if (ch === '"') inStr = !inStr;
    if (!inStr && /\s/.test(ch)) continue;
    out += ch;
  }
  return out.replace(/,(?=[}\])])/g, "");
}

/** The default project's `topology.ts`, rewritten so deployable `web` declares `connect`. */
export function withConnect(files: Files, connect: Record<string, string>): Files {
  const before = files.get("topology.ts") ?? "";
  const modules = /modules:\s*\[([^\]]*)\]/.exec(before)?.[1] ?? "";
  const out = new Map(files);
  out.set(
    "topology.ts",
    [
      `import { topology } from "@keel/server";`,
      "",
      "export default topology({",
      "  web: {",
      `    modules: [${modules}],`,
      `    adapter: "client",`,
      `    styles: ["@keel/ui/fonts"],`,
      `    origins: { connect: ${JSON.stringify(connect)} },`,
      "  },",
      "});",
      "",
    ].join("\n"),
  );
  return out;
}

export const diagCodes = (rs: CliRecord[]): unknown[] => rs.filter((r) => r.kind === "diag").map((r) => r.code);
export const text = (rs: CliRecord[]): string => JSON.stringify(rs);

function counts(r: CliRecord | undefined): Record<string, unknown> {
  const c = r?.counts;
  return typeof c === "object" && c !== null ? { ...c } : {};
}
/** `keel check` then `keel test` on a materialized project: both exit 0, no diagnostic, at least `testFiles` tests. */
export function expectCheckAndTestClean(dir: string, testFiles: number): void {
  const diags = (rs: CliRecord[]) => JSON.stringify(rs.filter((r) => r.kind === "diag"));
  const check = keel(dir, ["check"]);
  expect(check.status, diags(check.records)).toBe(0);
  expect(check.records.filter((r) => r.kind === "diag")).toEqual([]);
  const test = keel(dir, ["test"]);
  const summary = test.records.find((r) => r.kind === "summary" && r.name === "test");
  const detail = JSON.stringify(test.records.slice(0, 20));
  expect(test.status, detail).toBe(0);
  expect(summary?.ok, detail).toBe(true);
  expect(counts(summary).failed, detail).toBe(0);
  expect(Number(counts(summary).tests), detail).toBeGreaterThanOrEqual(testFiles);
}
export const testFileCount = (tree: Files): number => [...tree.keys()].filter((p) => /\.test\.tsx?$/.test(p)).length;
/** The trailer's counts of a `keel scaffold` run. */
export function trailerCounts(rs: CliRecord[]): Record<string, unknown> {
  return counts(rs.find((r) => r.kind === "summary" && typeof r.name === "string" && r.name.startsWith("scaffold")));
}
