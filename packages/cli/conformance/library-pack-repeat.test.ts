// k.library-pack, Pack (`--check`): "`keel pack --check` runs the same steps and writes nothing; its `ledger` step is E1164 when `.keel/ledger.json` is missing, fails its shape as an app reads it (Ledger file), or holds an `unsafe`, `hostElements` or `exports` other than the ones `keel pack` would write; other keys are not judged. Writing nothing, it changes nothing in the folder but under `node_modules/`, where the type cache lives (k.check-cache). A tarball is made by the package manager, whose `prepack` runs `keel pack --check`; it holds what `files` selects and what the package manager always packs (`package.json`, `README`, `LICENSE`), never a `node_modules` folder, and `keel pack` reads that list."
// Seed: 1337 (no generated input; the one property is the same run ten times). A gate that fails now and then is a defect: `keel pack --check` on one unchanged library gives one outcome and one output every time.
// Binary runs: 1 scaffold, 1 `keel pack`, then 10 `keel pack --check` on the scaffolded library, and 10 on `examples/library-charts` (its folder is read in place, not edited: `--check` writes nothing but under `node_modules/`).
// ASSUMPTIONS (spec silent): "the same outcome" is the exit status and every record of the output, byte for byte as the real binary prints it.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import type { Run } from "./compat-support.ts";
import { REPO, SLOW, cleanup, cloneLibrary, pack, scaffolded, snapshot } from "./library-support.ts";

const RUNS = 10;
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

const outcome = (r: Run): string => JSON.stringify({ status: r.status, records: r.records });

test(
  "`keel pack --check` on one unchanged scaffolded library gives ten identical outcomes and outputs, each exit 0",
  () => {
    const base = scaffolded();
    made.push(base.scratchDir);
    const lib = cloneLibrary(base.lib);
    expect(pack(lib).status).toBe(0);
    const before = snapshot(lib);
    const runs = Array.from({ length: RUNS }, () => outcome(pack(lib, true)));
    expect(
      runs.filter((r) => r !== runs[0]),
      `first: ${runs[0]}`,
    ).toEqual([]);
    expect(JSON.parse(runs[0] ?? "{}").status).toBe(0);
    expect(snapshot(lib)).toEqual(before);
  },
  SLOW,
);

test(
  "`keel pack --check` on `examples/library-charts`, unchanged, gives ten identical outcomes and outputs",
  () => {
    const dir = join(REPO, "examples/library-charts");
    expect(existsSync(join(dir, "package.json"))).toBe(true);
    const runs = Array.from({ length: RUNS }, () => outcome(pack(dir, true)));
    expect(
      runs.filter((r) => r !== runs[0]),
      `first: ${runs[0]}`,
    ).toEqual([]);
  },
  SLOW,
);
