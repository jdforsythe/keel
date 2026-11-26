// k.module the E1171 rule: a library's own folder, which `keel pack` refuses it in
// Spec: k.module, clause "`modules/a/sub/module.ts` beside `modules/a/module.ts` is one E1171, as `src/fmt/module.ts` and `unsafe/module.ts` of a library are, and a rule finding the module of `modules/a/sub/x.ts` (or the library's `src/fmt/fmt.ts`) by the longest `module.ts` folder prefix of the project it is given finds `modules/a/module.ts` (the library's root manifest)."
// Rules: E1171 "a `module.ts` (any code extension) other than a manifest: in an app, one deeper than `modules/<id>/module.ts`; in a library (k.library), one under `src/` or `unsafe/`, as installed and in its own folder, so `keel pack` refuses it (message `this module.ts is no manifest; modules/<id>/ or a library's root holds the manifest`; fix: none). No rule's project holds such a file, so none takes it for the manifest of the files beside it."
// Seed: 1337 (no generated input). Binary runs: one scaffolded library, then `keel pack` on a copy per placement (`src/fmt/module.ts`, `unsafe/module.ts`).
// ASSUMPTIONS (spec silent): the folder's `files` gains `unsafe/` so the `package` step, which runs first, passes; the nested file holds the scaffolded library's manifest text; "refuses" is a non-zero status, one E1171 at the file (package-relative in an own folder), and `keel pack`'s own E1164 `check: <n> errors; nothing packed` after it (k.library-pack Pack).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { SLOW, cleanup, cloneLibrary, isRecord, pack, scaffolded } from "./library-support.ts";

const MESSAGE = "this module.ts is no manifest; modules/<id>/ or a library's root holds the manifest";
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const base = scaffolded();
made.push(base.scratchDir);

for (const rel of ["src/fmt/module.ts", "unsafe/module.ts"]) {
  test(
    `\`${rel}\` of a library, in its own folder, is one E1171 and \`keel pack\` refuses it`,
    () => {
      const lib = cloneLibrary(base.lib);
      const manifest = readFileSync(join(lib, "module.ts"), "utf8");
      mkdirSync(dirname(join(lib, rel)), { recursive: true });
      writeFileSync(join(lib, rel), manifest);
      const pkgPath = join(lib, "package.json");
      const pkg: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (isRecord(pkg) && Array.isArray(pkg.files) && !pkg.files.some((x) => String(x).startsWith("unsafe"))) {
        pkg.files = [...pkg.files, "unsafe/"];
        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      }
      const r = pack(lib);
      const found = r.records.filter((x) => x.kind === "diag" && x.code === "E1171");
      expect(found.length, JSON.stringify(r.records).slice(0, 700)).toBe(1);
      expect(found[0]?.path).toBe(rel);
      expect(found[0]?.message).toBe(MESSAGE);
      expect(found[0]?.fix).toBeUndefined();
      expect(r.status).not.toBe(0);
      expect(r.records.some((x) => x.kind === "diag" && x.code === "E1164")).toBe(true);
    },
    SLOW,
  );
}
