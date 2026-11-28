import { copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
// Spec: k.compat, clause "After `keel build`, changing a string literal in a page component that no contract, binding or store reads leaves `keel check --frozen` with no E1005 on `.keel/surface.json`."
// Spec: k.compat, clause "In a tree with no `.keel/surface.json`, against a base where store `s` has state `{ a }`, adding a required field `b` is one E1563 at `b`."
// Seed 1337 n/a: fixed trees. Real binary over copies of `examples/client-only-api` (with the module `ping`, derived-support.ts `apiTree`) and `apps/household`.
// ASSUMED: the page component's string literal is the JSX text `A site with no server` of `HomePage.tsx`; the spec's store `s` with state `{ a }` and required field `b` is household's
// store `setup.household` (state `{ name }`) gaining the required field `size`, and "no `.keel/surface.json`" is the tree after `keel build` with `.keel/` deleted.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, expect, test } from "vitest";
import {
  type Tree,
  addSize,
  apiTree,
  brief,
  cloneTree,
  codes,
  dropTree,
  householdTree,
  keel,
  sub,
} from "./derived-support.ts";

const SLOW = fixedTime(600_000);
const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});
const track = (t: Tree): Tree => {
  made.push(t);
  return t;
};

test(
  "After `keel build`, changing a string literal in a page component that no contract, binding or store reads leaves `keel check --frozen` with no E1005 on `.keel/surface.json`.",
  () => {
    const t = track(apiTree());
    sub(t.dir, "modules/app/HomePage.tsx", "A site with no server", "A site with no backend");
    const out = keel(t.dir, ["check", "--frozen"]);
    expect(
      codes(out, "E1005").filter((d) => d.path === ".keel/surface.json"),
      brief(out),
    ).toEqual([]);
    expect(codes(out, "E1052"), brief(out)).toEqual([]);
    expect(out.status, brief(out)).toBe(0);
  },
  SLOW,
);

test(
  "In a tree with no `.keel/surface.json`, against a base where store `s` has state `{ a }`, adding a required field `b` is one E1563 at `b`.",
  () => {
    const t = cloneTree(track(householdTree()));
    track(t);
    const base = join(t.base, "committed-surface.json");
    copyFileSync(join(t.dir, ".keel/surface.json"), base);
    rmSync(join(t.dir, ".keel"), { recursive: true, force: true });
    addSize(t.dir);
    const out = keel(t.dir, ["check", "--base", base]);
    const e = codes(out, "E1563");
    expect(e, brief(out)).toHaveLength(1);
    expect(e[0]?.message).toContain("size");
  },
  SLOW,
);
