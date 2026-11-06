// Clause: k.scaffold generators — `project`: package.json, tokens.ts, topology.ts, vite.config.ts, module app, generated turbo and CI.
import { describe, expect, it } from "vitest";
import { apply, find, read } from "./fixtures.ts";

describe("scaffold project", () => {
  const files = apply("project", { name: "shop" }, new Map()).files;

  it("project yields a tokens.ts at the project root", () => {
    expect(files.has("tokens.ts")).toBe(true);
  });
  it("project yields a routes.ts (module app) and a topology.ts", () => {
    expect(find(files, /(^|\/)routes\.ts$/).length).toBeGreaterThan(0);
    expect(files.has("topology.ts")).toBe(true);
    expect(files.has("modules/app/module.ts")).toBe(true);
  });
  it("project yields a vite.config.ts importing @keel/compiler/vite", () => {
    expect(read(files, "vite.config.ts")).toContain("@keel/compiler/vite");
  });
  it("project yields a generated turbo.json carrying the generated marker", () => {
    expect(read(files, "turbo.json")).toMatch(/generated/i);
  });
  it("project yields files with one export per file and filename = export", () => {
    for (const [path, content] of files) {
      if (!/\.tsx?$/.test(path)) continue;
      const defaults = content.match(/^export\s+default\b/gm) ?? [];
      expect(defaults.length, path).toBeLessThanOrEqual(1);
      const m = content.match(/^export\s+default\s+(?:async\s+)?(?:function\s+|class\s+|const\s+)?([A-Za-z_]\w*)/m);
      const base =
        path
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") ?? "";
      if (m && /^[A-Z]/.test(base)) expect(m[1], path).toBe(base);
    }
  });
});
