// k.library In an app: a library's `src/` and `unsafe/` files compile at `modules/<id>/<f>`; no other file does.
import path from "node:path";
import fc from "fast-check";
import { expect, it } from "vitest";
import { libraryRel } from "../src/std/libraryRel.ts";
import type { Library } from "../src/types/Library.ts";

const lib = (dir: string, id: string | undefined, name = "@acme/charts"): Library => ({
  name,
  dir,
  kind: "library",
  id,
  manifest: undefined,
  files: [],
});
const seg = fc.stringMatching(/^f[a-z0-9]{0,6}$/);

it("a file under a library's src/ or unsafe/ reads at modules/<id>/<f>; any other file reads at none", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("src", "unsafe", "dist", "test", ""),
      fc.array(seg, { minLength: 1, maxLength: 3 }),
      fc.option(seg, { nil: undefined }),
      (top, parts, id) => {
        const dir = path.join(path.sep, "w", "charts");
        const rel = [top, ...parts].filter((p) => p !== "").join("/");
        const file = `${path.join(dir, ...rel.split("/"))}.tsx`;
        const want = top === "src" || top === "unsafe" ? `modules/${id ?? "@acme/charts"}/${rel}.tsx` : undefined;
        expect(libraryRel([lib(dir, id)], file)).toBe(want);
        expect(libraryRel([lib(dir, id)], path.join(path.sep, "w", "other", "src", "a.tsx"))).toBeUndefined();
      },
    ),
    { seed: 1337, numRuns: 60 },
  );
});

it("the library whose folder holds the file names its folder", () => {
  const a = lib(path.join(path.sep, "w", "a"), "aa", "@acme/a");
  const b = lib(path.join(path.sep, "w", "b"), "bb", "@acme/b");
  expect(libraryRel([a, b], path.join(path.sep, "w", "b", "src", "x.ts"))).toBe("modules/bb/src/x.ts");
});
