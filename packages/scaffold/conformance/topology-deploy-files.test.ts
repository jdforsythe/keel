// Spec: k.deploy Conformance, deploy files. Seed 1337 (fixed fixture; the byte position of the tamper is generated).
// ASSUMPTIONS: `place` takes `{ module, to, adapter? }` (k.scaffold Codemods: `place <module> --to <deployable> --adapter <adapter>`),
// the pure `scaffold(op, input, files)` regenerates deploy files like `keel build`, and E1005 is read from `keel check` on the materialized tree.
import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, type Op, SEED, apply, fresh, snap } from "./fixtures.ts";
import { cleanup, keel, materialize } from "./keel-cli.ts";

// `place` is not in the `Op` type yet (RFC 0080); the guard only narrows the name.
const isOp = (v: string): v is Op => v.length > 0;
function place(input: Record<string, unknown>, files: Files): Files {
  const name = "place";
  if (!isOp(name)) throw new Error("unreachable");
  return apply(name, input, files).files;
}

function topologyFiles(): Files {
  let files = fresh(); // modules: app, orders, catalog; topology.ts has the project deployable
  files = place({ module: "orders", to: "x", adapter: "node" }, files);
  files = place({ module: "catalog", to: "y", adapter: "node" }, files);
  files = place({ module: "app", to: "w", adapter: "client" }, files);
  return files;
}
const dockerfiles = (files: Files) => [...files.keys()].filter((p) => /(^|\/)Dockerfile$/.test(p)).sort();
const changed = (before: Files, after: Files) =>
  [...new Set([...before.keys(), ...after.keys()])].filter((p) => before.get(p) !== after.get(p)).sort();

describe("k.deploy: deploy files", () => {
  test("With `node` deployables `x`, `y` and a `client` one, `keel build` writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile; a changed byte is E1005 whose fix restores it; moving `b` from `y` to `x` changes only `topology.ts`, `deploy/` and the CI workflow.", async () => {
    const files = topologyFiles();
    expect(dockerfiles(files)).toEqual(["deploy/x/Dockerfile", "deploy/y/Dockerfile"]);
    expect(files.has("deploy/compose.yaml")).toBe(true);
    expect(files.get("deploy/x/Dockerfile")).toContain("node:22-slim");

    const moved = place({ module: "catalog", to: "x" }, files);
    for (const p of changed(files, moved)) {
      expect(p === "topology.ts" || p.startsWith("deploy/") || p === ".github/workflows/ci.yml", p).toBe(true);
    }
    expect(snap(place({ module: "catalog", to: "y", adapter: "node" }, moved))).toBe(snap(files));

    const target = "deploy/x/Dockerfile";
    const original = files.get(target) ?? "";
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: Math.max(0, original.length - 1) }), async (at) => {
        const dir = materialize(files);
        try {
          const clean = keel(dir, ["check"]);
          expect(clean.records.filter((r) => r["code"] === "E1005")).toEqual([]);
          const flipped = `${original.slice(0, at)}${original[at] === "#" ? "!" : "#"}${original.slice(at + 1)}`;
          fs.writeFileSync(path.join(dir, target), flipped);
          const e1005 = keel(dir, ["check"]).records.filter((r) => r["code"] === "E1005" && r["path"] === target);
          expect(e1005).toHaveLength(1);
          expect(typeof e1005[0]?.["fix"]).toBe("string");
        } finally {
          cleanup(dir);
        }
      }),
      { seed: SEED, numRuns: 3 },
    );
  });
});
