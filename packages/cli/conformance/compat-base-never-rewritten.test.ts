// Spec: k.compat, clause "In a copy of `apps/household`, after giving the `setup.household` store's state a required field, `keel check --base .keel/surface.json` reports one E1563 naming that field and leaves `.keel/surface.json` byte-identical, and a second run of that command reports the same E1563."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts (built, so its `.keel/surface.json` is the base), the required field `size` of `addSize`.
// The case "every other view is refreshed beside the error" states k.compat Base ("every other view that differs is refreshed (k.derived Refresh), beside an error too"): `.keel/ids.json` and `.keel/routes.json` are deleted before the run, so each differs from the derivation.
import { fixedTime } from "@keel/tooling/test-time";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  type Tree,
  addSize,
  brief,
  cloneTree,
  codes,
  dropTree,
  householdTree,
  keel,
  read,
  views,
} from "./derived-support.ts";

const SLOW = fixedTime(600_000);
const SURFACE = ".keel/surface.json";

let house: Tree | undefined;
const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});
/** A copy of the built household with the required field added; its surface is still the one before the edit. */
function edited(): Tree {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  addSize(t.dir);
  return t;
}
const BASE = ["check", "--base", SURFACE];

describe("k.compat Base: a run never rewrites the file `--base` names", () => {
  test(
    "In a copy of `apps/household`, after giving the `setup.household` store's state a required field, `keel check --base .keel/surface.json` reports one E1563 naming that field",
    () => {
      const t = edited();
      const out = keel(t.dir, BASE);
      const e = codes(out, "E1563");
      expect(e, brief(out)).toHaveLength(1);
      expect(e[0]?.message).toContain("size");
    },
    SLOW,
  );

  test(
    "`keel check --base .keel/surface.json` leaves `.keel/surface.json` byte-identical",
    () => {
      const t = edited();
      const before = read(t.dir, SURFACE);
      const out = keel(t.dir, BASE);
      expect(codes(out, "E1563"), brief(out)).toHaveLength(1);
      expect(read(t.dir, SURFACE)).toBe(before);
    },
    SLOW,
  );

  test(
    "a second run of that command with no edit between reports the same E1563 and leaves `.keel/surface.json` byte-identical",
    () => {
      const t = edited();
      const before = read(t.dir, SURFACE);
      const first = keel(t.dir, BASE);
      const second = keel(t.dir, BASE);
      expect(codes(second, "E1563"), brief(second)).toEqual(codes(first, "E1563"));
      expect(codes(second, "E1563")).toHaveLength(1);
      expect(read(t.dir, SURFACE)).toBe(before);
    },
    SLOW,
  );

  test(
    "every other view that differs is still refreshed beside the E1563, byte-identical to what `keel build` writes",
    () => {
      const t = edited();
      for (const v of ["ids", "routes"]) rmSync(join(t.dir, `.keel/${v}.json`), { force: true });
      const out = keel(t.dir, BASE);
      expect(codes(out, "E1563"), brief(out)).toHaveLength(1);
      expect(existsSync(join(t.dir, ".keel/ids.json"))).toBe(true);
      expect(existsSync(join(t.dir, ".keel/routes.json"))).toBe(true);
      const left = views(t.dir);
      const control = cloneTree(t);
      made.push(control);
      const built = keel(control.dir, ["build"]);
      expect(built.status, brief(built)).toBe(0);
      const want = views(control.dir);
      for (const v of Object.keys(want)) if (v !== SURFACE) expect(left[v], v).toBe(want[v]);
    },
    SLOW,
  );
});
