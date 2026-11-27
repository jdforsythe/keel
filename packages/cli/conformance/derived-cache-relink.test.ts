// Spec: k.derived, clause "In the copy of clause 9, after one `keel check`, pointing `node_modules/@keel/std-text` at a second linked copy whose `line` default `min` is 2 makes the next `keel check` have `counts.evaluated` 1 and leave `.keel/surface.json` byte-identical to what `keel build` writes."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts (`@keel/std-text` linked outside `node_modules`), built once and cloned per case.
// The second copy is a copy of the first with `line`'s default `min` 2, at `<base>/alt/std-text`; the link is the one at `node_modules/@keel/std-text`.
// The cases "pointed back" and "an unchanged link" state k.derived Derivation cache ("each symbolic link on it a real-path probe, so a link pointed at another folder is a miss") and are not part of the clause's one sentence.
import { rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { lineSurface, secondCopy, surfaceIsBuilt } from "./derived-cache-support.ts";
import { type Tree, brief, cloneTree, dropTree, householdTree, keel, read } from "./derived-support.ts";

const SLOW = fixedTime(600_000);

let house: Tree | undefined;
const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});
/** A copy of the built household tree after one `keel check`, and a second linked copy whose default `min` is 2. */
function warm(): { t: Tree; alt: string; link: string } {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  const first = keel(t.dir, ["check"]);
  expect(first.status, brief(first)).toBe(0);
  return { t, alt: secondCopy(t, 2), link: join(t.dir, "node_modules", "@keel", "std-text") };
}
const point = (link: string, to: string): void => {
  rmSync(link, { force: true });
  symlinkSync(to, link);
};

describe("k.derived: a re-linked package is a miss", () => {
  test(
    "In the copy of clause 9, after one `keel check`, pointing `node_modules/@keel/std-text` at a second linked copy whose `line` default `min` is 2 makes the next `keel check` have `counts.evaluated` 1 and leave `.keel/surface.json` byte-identical to what `keel build` writes.",
    () => {
      const { t, alt, link } = warm();
      point(link, alt);
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
    },
    SLOW,
  );

  test(
    "pointing the link at a second copy leaves `.keel/surface.json` holding the new value, byte-identical to what `keel build` writes",
    () => {
      const { t, alt, link } = warm();
      point(link, alt);
      const out = keel(t.dir, ["check"]);
      expect(read(t.dir, ".keel/surface.json"), brief(out)).toContain(lineSurface(2));
      expect(read(t.dir, ".keel/surface.json")).not.toContain(lineSurface(1));
      expect(surfaceIsBuilt(t)).toBe(true);
    },
    SLOW,
  );

  test(
    "pointing the link back at the first copy gives the first answer again: `.keel/surface.json` holds the first value, byte-identical to what `keel build` writes",
    () => {
      const { t, alt, link } = warm();
      const original = read(t.dir, ".keel/surface.json");
      const firstTarget = join(t.base, "std-text");
      point(link, alt);
      keel(t.dir, ["check"]);
      point(link, firstTarget);
      const out = keel(t.dir, ["check"]);
      expect(out.status, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/surface.json")).toBe(original);
      expect(read(t.dir, ".keel/surface.json")).toContain(lineSurface(1));
      expect(surfaceIsBuilt(t)).toBe(true);
    },
    SLOW,
  );

  test(
    "an unchanged link is a hit: the next `keel check` has `counts.evaluated` 0 and `counts.cached` 1",
    () => {
      const { t } = warm();
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
    },
    SLOW,
  );
});
