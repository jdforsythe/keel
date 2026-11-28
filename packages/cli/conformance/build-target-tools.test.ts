// k.shell, Build "4. The shell entry and web build into `dist/<name>/<shell>/www/` (the Vite plugin, given `KEEL_SHELL`), `deploy/<name>/<shell>/` copied beside it."
// Seed: 1337 (no generated input: the build is the one the clause names; the origin is fixed).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`): the stub's `build` records whether `www/index.html` and the copied `a.json` were already in `dir`, and its `dir`.
// The "at most 12" case is shell-target-build.test.ts; the icon, `package.json` and http-permission cases are std-tauri's and std-capacitor's `build-tools.test.ts`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { A_JSON, SLOW, buildCalls, cleanup, run, stubProject } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

describe("k.shell: build steps over a stub package", () => {
  test(
    "The shell entry and web build into `dist/<name>/<shell>/www/`, `deploy/<name>/<shell>/` copied beside it.",
    () => {
      const r = run(dir, ["build", "--target", "tauri"]);
      expect(r.status).toBe(0);
      expect(existsSync(join(dir, "dist", "web", "tauri", "www", "index.html"))).toBe(true);
      expect(readFileSync(join(dir, "dist", "web", "tauri", "a.json"), "utf8")).toBe(A_JSON);
      const calls = buildCalls(dir);
      expect(calls).toHaveLength(1);
      const call = calls[0];
      expect(String(call?.dir).endsWith(join("dist", "web", "tauri"))).toBe(true);
      expect(call?.www).toBe(true);
      expect(call?.a).toBe(true);
    },
    SLOW,
  );
});
