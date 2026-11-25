// Spec: k.data, clause "`keel build` of a fixture whose `node` deployable serves module `a` holding `modules/a/migrations/0001-x.sql` writes `dist/<name>/modules/a/migrations/0001-x.sql` with the same bytes, and no folder for a module of a `client` deployable."
// Seed 1337 (the file name number comes from `fc.integer`). Assumes: the build writes the copy at `dist/<deployable>/modules/<id>/migrations/<file>`; fixture in app-data-support.ts (module `m` on node `api`, `w` on client `web`).
// Pending: the build does not copy yet.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, SLOW, built, cleanup, materialize } from "./boundary-support.ts";
import { MIGRATION_BYTES, appDataTree } from "./app-data-support.ts";

test(
  "`keel build` of a fixture whose `node` deployable serves module `a` holding `modules/a/migrations/0001-x.sql` writes `dist/<name>/modules/a/migrations/0001-x.sql` with the same bytes, and no folder for a module of a `client` deployable.",
  () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999 }), fc.string({ maxLength: 40 }), (n, tail) => {
        const dir = materialize(appDataTree());
        try {
          const name = `${String(n).padStart(4, "0")}-y.sql`;
          const bytes = `${MIGRATION_BYTES}-- ${tail}\n`;
          writeFileSync(join(dir, "modules/m/migrations", name), bytes);
          const r = built(dir);
          expect(r.status, r.out).toBe(0);
          const copy = join(dir, "dist/api/modules/m/migrations");
          expect(readFileSync(join(copy, "0001-x.sql"))).toEqual(Buffer.from(MIGRATION_BYTES));
          expect(readFileSync(join(copy, name))).toEqual(Buffer.from(bytes));
          expect(existsSync(join(dir, "dist/web/modules/w"))).toBe(false);
          expect(existsSync(join(dir, "dist/api/modules/w"))).toBe(false);
        } finally {
          cleanup(dir);
        }
      }),
      { seed: SEED, numRuns: 2 },
    );
  },
  SLOW,
);
