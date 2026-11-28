// Spec: k.derived, clause "In the copy of clause 9, after one `keel check`, pointing `node_modules/@keel/std-text` at a second linked copy whose `line` default `min` is 2 makes the next `keel check` have `counts.evaluated` 1 and leave `.keel/surface.json` byte-identical to what `keel build` writes."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts (`@keel/std-text` linked outside `node_modules`), built once and cloned per case.
// The second copy is a copy of the first with `line`'s default `min` 2, at `<base>/alt/std-text`; the link is the one at `node_modules/@keel/std-text`.
// Also states, k.derived Derivation cache: "An input is recorded by its path through the project and resolved again at every read, each symbolic link on it, and its `node_modules/<name>` entry, a real-path probe, so a link pointed elsewhere is a miss, to the same bytes too."
// Spec: k.compiler, clause "In the copy of k.derived clause 9 whose linked `@keel/std-text` file `line.ts` is a symbolic link to `line.a.ts`, after one `keel check`, pointing that link at `line.b.ts`, a copy of `line.a.ts`, makes the next `keel check` have `counts.evaluated` 1 and `counts.cached` 0."
// The cases "pointed back" and "an unchanged link" state the Derivation cache sentence above and are not part of the first clause's one sentence.
import { copyFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { lineSurface, secondCopy, surfaceIsBuilt } from "./derived-cache-support.ts";
import { type Tree, brief, cloneTree, dropTree, editStdText, householdTree, keel, read } from "./derived-support.ts";

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

describe("k.derived: a link inside a package on the path to a loaded file, pointed at another file, is a miss", () => {
  // Spec: Derivation cache, "each symbolic link on it ... a real-path probe, so a link pointed elsewhere is a miss, to the same bytes too": every link on an input's path, whatever it is a link to.
  // The linked copy's `line.ts` (a file its evaluation loads) becomes a link to `line.a.ts`, a copy of it; `line.b.ts` is a copy whose default `min` is `min`.
  /** A household copy whose `line.ts` of `@keel/std-text` is a link to `line.a.ts`, after one `keel check`; returns the link's folder and the link. */
  function linked(): { t: Tree; folder: string; link: string } {
    house ??= householdTree();
    if (!made.includes(house)) made.push(house);
    const t = cloneTree(house);
    made.push(t);
    const rel = editStdText(t, "min ?? 1", "min ?? 1", false)[0];
    if (rel === undefined) throw new Error("no line.ts");
    const link = join(t.base, rel);
    const folder = dirname(link);
    copyFileSync(link, join(folder, "line.a.ts"));
    rmSync(link);
    symlinkSync("line.a.ts", link);
    const first = keel(t.dir, ["check"]);
    expect(first.status, brief(first)).toBe(0);
    return { t, folder, link };
  }
  /** Writes `line.b.ts`, a copy of `line.a.ts` with its default `min` `min`. */
  function other(folder: string, min: number): void {
    const text = read(folder, "line.a.ts").replace("min ?? 1", `min ?? ${String(min)}`);
    rmSync(join(folder, "line.b.ts"), { force: true });
    copyFileSync(join(folder, "line.a.ts"), join(folder, "line.b.ts"));
    writeFileSync(join(folder, "line.b.ts"), text);
  }
  const repoint = (link: string, to: string): void => {
    rmSync(link);
    symlinkSync(to, link);
  };

  test(
    "an unchanged link inside the package is a hit: `counts.evaluated` 0 and `counts.cached` 1",
    () => {
      const { t } = linked();
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
    },
    SLOW,
  );

  test(
    "In the copy of k.derived clause 9 whose linked `@keel/std-text` file `line.ts` is a symbolic link to `line.a.ts`, after one `keel check`, pointing that link at `line.b.ts`, a copy of `line.a.ts`, makes the next `keel check` have `counts.evaluated` 1 and `counts.cached` 0, and `.keel/surface.json` byte-identical to what `keel build` writes",
    () => {
      const { t, folder, link } = linked();
      const before = read(t.dir, ".keel/surface.json");
      other(folder, 1);
      repoint(link, "line.b.ts");
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/surface.json")).toBe(before);
      expect(surfaceIsBuilt(t)).toBe(true);
    },
    SLOW,
  );

  test(
    "pointing that link at another file with a default `min` of 2 makes the next `keel check` have `counts.evaluated` 1 and `.keel/surface.json` hold the new value, byte-identical to what `keel build` writes",
    () => {
      const { t, folder, link } = linked();
      other(folder, 2);
      repoint(link, "line.b.ts");
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(read(t.dir, ".keel/surface.json")).toContain(lineSurface(2));
      expect(surfaceIsBuilt(t)).toBe(true);
    },
    SLOW,
  );
});
