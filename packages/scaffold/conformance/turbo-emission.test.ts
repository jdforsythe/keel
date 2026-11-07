// Spec: k.scaffold, clause "After `scaffold module`, `turbo.json` equals the generator's output for the new task graph."
// The generator is a pure function of the task graph, so the same module set yields the same turbo.json regardless of the order modules were added.
// The expected graph is computed here, independently, from the tree and ADR-0009: modules = every modules/<id>/module.ts and
// every id in topology.ts; tasks check, test, build where test and build depend on check.
import fc from "fast-check";
import { expect, it } from "vitest";
import { type Files, RUNS, SEED, apply, distinctPair, fresh, lowerName, read } from "./fixtures.ts";

// seed 1337
it("after scaffold module, turbo.json equals the generator's output for the new task graph", () => {
  fc.assert(
    fc.property(distinctPair(lowerName), ([a, b]) => {
      const root = apply("project", { name: "shop" }, new Map()).files;
      const ab = apply("module", { id: b }, apply("module", { id: a }, root).files).files;
      const ba = apply("module", { id: a }, apply("module", { id: b }, root).files).files;
      expect(read(ab, "turbo.json")).toBe(read(ba, "turbo.json"));
      expect(read(ab, "turbo.json")).toMatch(/generated/i);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("scaffold module regenerates turbo.json and reports it among the written files", () => {
  const root = apply("project", { name: "shop" }, new Map()).files;
  const out = apply("module", { id: "orders" }, root);
  expect([...out.created, ...out.changed]).toContain("turbo.json");
});

function moduleSet(files: Files): string[] {
  const ids = new Set<string>();
  for (const p of files.keys()) {
    const m = /^modules\/([^/]+)\/module\.ts$/.exec(p);
    if (m?.[1] !== undefined) ids.add(m[1]);
  }
  for (const list of read(files, "topology.ts").matchAll(/modules:\s*\[([^\]]*)\]/g)) {
    for (const q of (list[1] ?? "").matchAll(/["']([^"']+)["']/g)) if (q[1] !== undefined) ids.add(q[1]);
  }
  return [...ids].sort();
}

function parseTurbo(files: Files): Record<string, { dependsOn: string[]; inputs: string[] }> {
  const text = read(files, "turbo.json");
  const lines = text.split("\n");
  expect(lines[0]).toMatch(/^\/\//);
  const doc: unknown = JSON.parse(lines.slice(1).join("\n"));
  const tasks = typeof doc === "object" && doc !== null && "tasks" in doc ? doc.tasks : undefined;
  if (typeof tasks !== "object" || tasks === null) throw new Error("turbo.json has no tasks object");
  const out: Record<string, { dependsOn: string[]; inputs: string[] }> = {};
  for (const [name, t] of Object.entries(tasks)) {
    const strs = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    out[name] = { dependsOn: strs(t?.dependsOn), inputs: strs(t?.inputs) };
  }
  return out;
}

function expectGraph(files: Files): void {
  const tasks = parseTurbo(files);
  expect(Object.keys(tasks).sort()).toEqual(["build", "check", "test"]);
  expect(tasks.check?.dependsOn).toEqual([]);
  expect(tasks.test?.dependsOn).toEqual(["check"]);
  expect(tasks.build?.dependsOn).toEqual(["check"]);
  const want = moduleSet(files).map((id) => `modules/${id}/**`);
  for (const [name, t] of Object.entries(tasks)) {
    const mods = t.inputs.filter((i) => i.startsWith("modules/"));
    expect(mods.slice().sort(), `${name} module inputs`).toEqual(want);
    for (const other of t.inputs.filter((i) => !i.startsWith("modules/")))
      expect(files.has(other), `${name} input ${other} exists in the tree`).toBe(true);
  }
}

it("turbo.json after scaffold module has the check/test/build task graph with exactly the tree's modules as inputs", () => {
  const root = apply("project", { name: "shop" }, new Map()).files;
  expectGraph(root);
  const out = apply("module", { id: "orders" }, root).files;
  expect(moduleSet(out)).toEqual(["app", "orders"]);
  expectGraph(out);
  expectGraph(apply("module", { id: "catalog" }, out).files);
});

it("for 1-4 generated modules added in any order turbo.json is byte-identical and matches the computed task graph", () => {
  // seed 1337
  fc.assert(
    fc.property(fc.uniqueArray(lowerName, { minLength: 1, maxLength: 4 }), fc.nat(), (names, k) => {
      const root = apply("project", { name: "shop" }, new Map()).files;
      const add = (order: string[]) => order.reduce((f, id) => apply("module", { id }, f).files, root);
      const rot = k % names.length;
      const rotated = [...names.slice(rot), ...names.slice(0, rot)];
      const a = add(names);
      const b = add(rotated.reverse());
      expectGraph(a);
      expect(read(a, "turbo.json")).toBe(read(b, "turbo.json"));
      expect(read(a, ".github/workflows/ci.yml")).toBe(read(b, ".github/workflows/ci.yml"));
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("after rename of a module, turbo.json lists the new module and no stale one", () => {
  const out = apply("rename", { kind: "module", from: "catalog", to: "market" }, fresh()).files;
  expect(moduleSet(out)).toEqual(["app", "market", "orders"]);
  expectGraph(out);
  expect(read(out, "turbo.json")).not.toContain("modules/catalog/");
});

it("the CI workflow is regenerated with turbo.json: generated header, same bytes for the same module set", () => {
  const root = apply("project", { name: "shop" }, new Map()).files;
  const a = apply("module", { id: "billing" }, apply("module", { id: "orders" }, root).files).files;
  const b = apply("module", { id: "orders" }, apply("module", { id: "billing" }, root).files).files;
  const ci = read(a, ".github/workflows/ci.yml");
  expect(ci).toMatch(/^# _generated/);
  expect(ci).toBe(read(b, ".github/workflows/ci.yml"));
});
