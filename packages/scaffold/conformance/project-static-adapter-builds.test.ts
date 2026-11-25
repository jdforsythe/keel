// k.scaffold, Codemods "`project`: `package.json`, `.gitignore`, `tokens.ts`, `topology.ts` (`--adapter client|node|static`, default `client`), `vite.config.ts`, module `app`, ... `--workspace` (an app inside the Keel monorepo) adds `index.html` and `vitest.config.ts` instead of turbo, CI, agent files."
// k.topology, Declaration "Adapters: `node` (serves the resume entry), `static` (prerendered HTML), `client` (loaders, actions in the browser; entry `mount(App, el)`, real `ctx`)."
// Seed 1337 (no generated inputs: one project per form, the real `keel` binary). No clause names the result of building a scaffolded `--adapter static` project;
// the nearest text is the two above, so the case asserts what a project of any adapter must do: `keel build` exits 0.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanup, keel, materialize } from "./keel-cli.ts";

for (const workspace of [false, true]) {
  const flags = workspace ? ["--workspace"] : [];
  describe(`keel scaffold project --adapter static ${workspace ? "--workspace" : "(standalone)"}`, () => {
    it("scaffolds a static deployable and `keel build` of the project exits 0", () => {
      const dir = materialize(new Map());
      try {
        const made = keel(dir, ["scaffold", "project", "shop", "--adapter", "static", ...flags]);
        expect(made.status, JSON.stringify(made.records)).toBe(0);
        const proj = join(dir, "shop");
        expect(readFileSync(join(proj, "topology.ts"), "utf8")).toContain("static");
        const built = keel(proj, ["build"]);
        expect(built.status, JSON.stringify(built.records)).toBe(0);
        expect(existsSync(join(proj, "dist"))).toBe(true);
      } finally {
        cleanup(dir);
      }
    }, 120_000);
  });
}
