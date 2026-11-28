// Seed 1337. k.create-folder Folder: `.keel-create` lists every file, then every folder the run makes inside the
// folder, `/`-ended, deepest first; removing what it lists, in order, then it, leaves the folder as it was (property:
// the marker read at any write of a plan, followed from there, restores the folder that existed before the run).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MARKER } from "@keel/scaffold/create";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { writePlan } from "../src/writePlan.ts";

const SEED = 1337;
const walk = (dir: string, rel = ""): string[] =>
  existsSync(join(dir, rel))
    ? readdirSync(join(dir, rel))
        .sort()
        .flatMap((n) => {
          const p = rel === "" ? n : `${rel}/${n}`;
          return statSync(join(dir, p)).isDirectory() ? [`${p}/`, ...walk(dir, p)] : [p];
        })
    : [];
/** E1366's fix, mechanically: each listed path that exists, in order, then the marker. */
const follow = (dir: string, listing: string): void => {
  for (const line of listing.split("\n").filter((l) => l !== "")) {
    const p = join(dir, line);
    if (!existsSync(p)) continue;
    if (line.endsWith("/")) rmdirSync(p);
    else rmSync(p);
  }
};
/** Copies the folder's tree (files as text) so a run that goes on can be compared with one stopped at that write. */
const copy = (from: string, to: string): void => {
  mkdirSync(to, { recursive: true });
  for (const p of walk(from))
    if (p.endsWith("/")) mkdirSync(join(to, p), { recursive: true });
    else writeFileSync(join(to, p), readFileSync(join(from, p)));
};

describe("writePlan's marker", () => {
  it("lists the files, then the folders the run makes, deepest first, and not a folder that was there", async () => {
    const root = tempDir("keel-marker-");
    const files = new Map([
      ["a/b/c.txt", "c"],
      ["a/d.txt", "d"],
      ["e.txt", "e"],
      ["k/x.txt", "x"],
    ]);
    mkdirSync(join(root, "shop", "k"), { recursive: true });
    let listing = "";
    const r = await writePlan(join(root, "shop"), files, {
      written: () => {
        if (listing === "") listing = readFileSync(join(root, "shop", MARKER), "utf8");
      },
    });
    expect(r).toEqual({ ok: true });
    expect(listing).toBe("a/b/c.txt\na/d.txt\ne.txt\nk/x.txt\na/b/\na/\n");
  });

  it("followed from the write it was read at, restores the folder as it was before the run", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.stringMatching(/^[a-c](\/[a-c]){0,2}\.t$/), { minLength: 1, maxLength: 8 }),
        fc.boolean(),
        fc.nat(),
        async (paths, existing, at) => {
          const root = tempDir("keel-marker-");
          const shop = join(root, "shop");
          if (existing) {
            mkdirSync(join(shop, "a"), { recursive: true });
            writeFileSync(join(shop, "keep.txt"), "keep\n");
          }
          const before = walk(shop);
          const files = new Map(paths.filter((p) => !before.includes(p)).map((p) => [p, p]));
          const stopAt = at % (files.size + 1);
          let n = 0;
          const frozen = join(root, "frozen");
          await writePlan(shop, files, {
            written: () => {
              if (n++ === stopAt) copy(shop, frozen);
            },
          });
          if (!existsSync(frozen)) return;
          follow(frozen, readFileSync(join(frozen, MARKER), "utf8"));
          rmSync(join(frozen, MARKER));
          expect(walk(frozen)).toEqual(before);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
