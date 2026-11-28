// k.server-deps Files a bundled package reads: a library linked through a workspace (a symlink in `node_modules/` to a
// real folder outside the project) has its bundled files' reads copied beside `server.mjs` as an installed one does.
// Seed 1337 (no generated input). Binary runs: 2 (`keel build`, then again with the file removed).
import { mkdirSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, expect, test } from "vitest";
import {
  SLOW,
  STORE,
  STORE_BIN,
  built,
  cleanup,
  dataLibrary,
  keelRun,
  loaderModule,
  materialize,
  recordsOf,
  serverDepsProject,
  textAt,
} from "../conformance/library-support.ts";

const DATA = `import { store } from '${STORE}'\nconst accessor = store()\nexport const data = (ctx: Parameters<typeof accessor>[0]): string => accessor(ctx).title()\n`;
let dir = "";
const outside = tempDir("keel-linked-");
afterAll(() => {
  cleanup(dir);
  rmSync(outside, { recursive: true, force: true });
});

test(
  "a linked library's `new URL('./store.bin', import.meta.url)` is copied to `dist/<name>/store.bin`; with the file gone, one E1014 at `node_modules/@acme/store/src/store.ts`",
  () => {
    dir = materialize(
      serverDepsProject({
        deployables: { api: ["a"] },
        modules: [{ id: "a", deps: [STORE], extra: loaderModule("a", DATA) }],
        libraries: [dataLibrary({ bin: true })],
      }),
    );
    const real = join(outside, "store");
    renameSync(join(dir, "node_modules", STORE), real);
    symlinkSync(real, join(dir, "node_modules", STORE));
    // A workspace package resolves its own dependencies from its own folder, as a linked one does.
    mkdirSync(join(real, "node_modules", "@keel"), { recursive: true });
    symlinkSync(join(dir, "node_modules", "@keel", "ctx"), join(real, "node_modules", "@keel", "ctx"));
    const r = built(dir);
    expect(r.status, r.out).toBe(0);
    expect(textAt(dir, "dist/api/store.bin")).toBe(STORE_BIN);
    rmSync(join(real, "src", "store.bin"));
    rmSync(join(dir, "dist"), { recursive: true, force: true });
    const again = keelRun(dir, ["build"]);
    expect(again.status, again.out).toBe(1);
    const hits = recordsOf(again.out, "E1014");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("node_modules/@acme/store/src/store.ts");
    expect(hits[0]).toContain("./store.bin");
    expect(textAt(dir, "dist/api/server.mjs")).toBeUndefined();
  },
  SLOW,
);
