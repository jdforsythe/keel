// Spec: k.scaffold, clause "In a project where `keel build` ran and `keel check` is clean, each generator applied by `keel scaffold` leaves `keel check` clean with no E1005, every file under `dist/` byte-identical, no W1005 in its output and a trailer whose `artifacts` is above 0; `keel scaffold service orders --base https://api.example.com --reason r` in the default project is one of them. With `--dry-run`, and in a project `keel build` never ran in, no file under `.keel/` is written and the trailer has no `artifacts`."
// k.scaffold, Refresh "It prints nothing while it runs and no W1005 for an artifact it rewrites; a diagnostic of the refresh follows the edit lines and the edits stay written."
// No random input: one fixed project per generator. ASSUMED trailer (json): { kind: "summary", name: "scaffold <op>", counts: { created, changed, removed, artifacts } };
// pretty trailer: `ok scaffold <op> <n> created, <n> changed, <n> removed, <n> artifacts, <n> errors`.
import { fixedTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { type Files, ORDERS_OPENAPI, fresh, withStoreCart } from "./fixtures.ts";
import { cleanup, keel, materialize, readTree, root } from "./keel-cli.ts";
import { ORIGIN, REASON, diagCodes, freshNode, text, trailerCounts } from "./service-base-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const under = (tree: Files, prefix: string): [string, string][] =>
  [...tree].filter(([p]) => p.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1));

function built(tree: Files): string {
  const dir = materialize(tree);
  dirs.push(dir);
  const b = keel(dir, ["build"]);
  expect(b.status, text(b.records)).toBe(0);
  const c = keel(dir, ["check"]);
  expect(c.status, text(c.records)).toBe(0);
  expect(diagCodes(c.records)).toEqual([]);
  return dir;
}

function withOpenApiNode(): Files {
  const t = freshNode();
  t.set("openapi.json", `${ORDERS_OPENAPI}\n`);
  return t;
}
function withOpenApiClient(): Files {
  const t = fresh();
  t.set("openapi.json", `${ORDERS_OPENAPI}\n`);
  return t;
}

const generators: [string, () => Files, string[]][] = [
  ["keel scaffold module billing", fresh, ["module", "billing"]],
  ["keel scaffold route orders.show --path /orders/:id", fresh, ["route", "orders.show", "--path", "/orders/:id"]],
  [
    "keel scaffold route orders.about --path /about --no-loader",
    fresh,
    ["route", "orders.about", "--path", "/about", "--no-loader"],
  ],
  ["keel scaffold component orders/OrderCard", fresh, ["component", "orders/OrderCard"]],
  ["keel scaffold store orders.cart", fresh, ["store", "orders.cart"]],
  ["keel scaffold transaction orders.cart.addItem", withStoreCart, ["transaction", "orders.cart.addItem"]],
  [
    "keel scaffold service orders --openapi openapi.json (node project)",
    withOpenApiNode,
    ["service", "orders", "--openapi", "openapi.json"],
  ],
  [
    "keel scaffold service orders --openapi openapi.json --reason r (default project)",
    withOpenApiClient,
    ["service", "orders", "--openapi", "openapi.json", "--reason", "r"],
  ],
  [
    "keel scaffold service orders --base https://api.example.com --reason r (default project)",
    fresh,
    ["service", "orders", "--base", ORIGIN, "--reason", "r"],
  ],
];

describe("in a built project, a scaffold refreshes in place of a build", () => {
  for (const [name, mk, args] of generators) {
    it(
      `${name} leaves check clean, no E1005, dist/ byte-identical, no W1005, artifacts above 0`,
      () => {
        const dir = built(mk());
        const distBefore = under(readTree(dir), "dist/");
        expect(distBefore.length).toBeGreaterThan(0);
        const gen = keel(dir, ["scaffold", ...args]);
        expect(gen.status, text(gen.records)).toBe(0);
        expect(text(gen.records)).not.toContain("E1005");
        expect(text(gen.records)).not.toContain("W1005");
        expect(Number(trailerCounts(gen.records).artifacts), text(gen.records)).toBeGreaterThan(0);
        expect(under(readTree(dir), "dist/")).toEqual(distBefore);
        const after = keel(dir, ["check"]);
        expect(after.status, text(after.records)).toBe(0);
        expect(diagCodes(after.records)).toEqual([]);
        expect(text(after.records)).not.toContain("E1005");
      },
      fixedTime(180000),
    );
  }
});

describe("the refresh prints nothing while it runs", () => {
  const run = (dir: string, args: string[], format: string[]): { status: number | null; lines: string[] } => {
    const env: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
      env[k] = v;
    }
    const r = spawnSync(process.execPath, [join(root, "packages/cli/src/bin.ts"), ...args, ...format], {
      cwd: dir,
      encoding: "utf8",
      env,
    });
    return { status: r.status, lines: r.stdout.split("\n").filter((l) => l.trim() !== "") };
  };
  it(
    "keel scaffold route app.home --path / --no-loader: the edit lines, then one ok trailer with artifacts, nothing else",
    () => {
      const dir = built(fresh());
      const r = run(dir, ["scaffold", "route", "app.home", "--path", "/", "--no-loader"], []);
      expect(r.status, r.lines.join("\n")).toBe(0);
      const last = r.lines.at(-1) ?? "";
      expect(last).toMatch(/^ok scaffold route \d+ created, \d+ changed, \d+ removed, [1-9]\d* artifacts, 0 errors$/);
      expect(r.lines.slice(0, -1).filter((l) => !/^(create|change|remove) \S+$/.test(l))).toEqual([]);
      expect(r.lines.join("\n")).not.toContain("W1005");
    },
    fixedTime(180000),
  );
  // OUTPUT.md fixes the compact trailer only; k.scaffold states for every format just "no W1005" and success.
  it(
    "keel scaffold route app.home --path / --no-loader --format=pretty: exit 0 and no W1005",
    () => {
      const dir = built(fresh());
      const r = run(dir, ["scaffold", "route", "app.home", "--path", "/", "--no-loader"], ["--format=pretty"]);
      expect(r.status, r.lines.join("\n")).toBe(0);
      expect(r.lines.join("\n")).not.toContain("W1005");
    },
    fixedTime(180000),
  );
});

describe("no refresh", () => {
  it(
    "--dry-run in a built project writes no file under .keel/ and the trailer has no artifacts",
    () => {
      const dir = built(fresh());
      const before = under(readTree(dir), ".keel/");
      expect(before.length).toBeGreaterThan(0);
      const r = keel(dir, ["scaffold", "service", "orders", "--base", ORIGIN, "--reason", REASON, "--dry-run"]);
      expect(r.status, text(r.records)).toBe(0);
      expect(under(readTree(dir), ".keel/")).toEqual(before);
      expect("artifacts" in trailerCounts(r.records)).toBe(false);
    },
    fixedTime(180000),
  );
  it(
    "in a project keel build never ran in, no file under .keel/ is written and the trailer has no artifacts",
    () => {
      const dir = materialize(fresh());
      dirs.push(dir);
      const before = under(readTree(dir), ".keel/");
      const r = keel(dir, ["scaffold", "route", "orders.show", "--path", "/orders/:id"]);
      expect(r.status, text(r.records)).toBe(0);
      expect(under(readTree(dir), ".keel/")).toEqual(before);
      expect("artifacts" in trailerCounts(r.records)).toBe(false);
    },
    fixedTime(120000),
  );
});
