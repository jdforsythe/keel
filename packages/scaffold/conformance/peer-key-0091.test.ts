// Spec: k.scaffold, clause "With `node` deployables `api` and `my-api`, `deploy/compose.yaml` sets `KEEL_PEER_MY_API` for `api`; `place b --to apiEdge --adapter node` is E1352 and writes nothing."
// k.scaffold, Rules "deployable names as k.topology E1552"
// Seed 1337 (fc.assert below). ASSUMPTIONS: `place` is a scaffold operation taking `{ module, to, adapter? }` (k.scaffold Codemods);
// the compose peer key is read from the generated `deploy/compose.yaml` text.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, type Op, SEED, apply, errText, fresh, scaffoldRaw, snap } from "./fixtures.ts";

// `place` is not in the `Op` type yet; the guard only narrows the name.
const isOp = (v: string): v is Op => v.length > 0;
function placeRaw(input: Record<string, unknown>, files: Files) {
  const name = "place";
  if (!isOp(name)) throw new Error("unreachable");
  return scaffoldRaw(name, input, files);
}
function place(input: Record<string, unknown>, files: Files): Files {
  const name = "place";
  if (!isOp(name)) throw new Error("unreachable");
  return apply(name, input, files).files;
}

const formOk = /^[a-z][a-z0-9-]*$/;
const keyOk = /^KEEL_PEER_[A-Z][A-Z0-9_]*$/;
const deployableName = fc.stringMatching(/^[a-z][a-z0-9-]{0,11}$/).filter((n) => n !== "api" && n !== "app");

describe("k.scaffold: deployable names and peer keys", () => {
  test("With `node` deployables `api` and `my-api`, `deploy/compose.yaml` sets `KEEL_PEER_MY_API` for `api`", () => {
    let files = fresh();
    files = place({ module: "orders", to: "api", adapter: "node" }, files);
    files = place({ module: "catalog", to: "my-api", adapter: "node" }, files);
    const compose = files.get("deploy/compose.yaml") ?? "";
    expect(compose).toContain("KEEL_PEER_MY_API");
    expect(compose).not.toContain("KEEL_PEER_MY-API");
  });

  test("`place b --to apiEdge --adapter node` is E1352 and writes nothing", () => {
    const files = fresh();
    const before = snap(files);
    const r = placeRaw({ module: "catalog", to: "apiEdge", adapter: "node" }, files);
    expect(r.ok).toBe(false);
    expect(errText(r)).toContain("E1352");
    expect(snap(files)).toBe(before);
  });

  test("every accepted deployable name matches `[a-z][a-z0-9-]*` and its compose key matches `^KEEL_PEER_[A-Z][A-Z0-9_]*$`; any other name is E1352", () => {
    fc.assert(
      fc.property(deployableName, fc.string({ maxLength: 10 }), (good, anything) => {
        const files = fresh();
        const before = snap(files);
        const bad = formOk.test(anything) ? `${anything}_X` : anything;
        const refused = placeRaw({ module: "catalog", to: bad, adapter: "node" }, files);
        expect(refused.ok, JSON.stringify(bad)).toBe(false);
        expect(errText(refused)).toContain("E1352");
        expect(snap(files)).toBe(before);

        const r = placeRaw({ module: "catalog", to: good, adapter: "node" }, files);
        expect(r.ok, good).toBe(true);
        expect(formOk.test(good)).toBe(true);
        let next = place({ module: "catalog", to: good, adapter: "node" }, files);
        next = place({ module: "orders", to: "zqpeer", adapter: "node" }, next);
        const compose = next.get("deploy/compose.yaml") ?? "";
        const keys = [...compose.matchAll(/\bKEEL_PEER_[A-Za-z0-9_-]+/g)].map((m) => m[0]);
        expect(keys).toContain(`KEEL_PEER_${good.toUpperCase().replaceAll("-", "_")}`);
        for (const k of keys) expect(keyOk.test(k), k).toBe(true);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
