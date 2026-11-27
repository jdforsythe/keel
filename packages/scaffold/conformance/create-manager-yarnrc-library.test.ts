// k.create-manager, Package manager "Yarn also gets `.yarnrc.yml` holding `nodeLinker: node-modules`, since the checker and `keel docs` read `node_modules`."
// Seed 1337 (recorded; no generated inputs). The app case is in create-plan.test.ts; these are the library cases, with the app beside them.
import { describe, expect, it } from "vitest";
import { json, librarySet, paths, plan, sorted } from "./create-plan-support.ts";

describe("k.create-manager: Yarn also gets `.yarnrc.yml`", () => {
  it("Yarn also gets `.yarnrc.yml` holding `nodeLinker: node-modules`: a library created under `yarn/4.5.0` writes it", () => {
    const p = plan({ library: "@acme/charts", userAgent: "yarn/4.5.0 npm/? node/v22.15.0" });
    expect(p.ok, p.text).toBe(true);
    expect(p.files.get(".yarnrc.yml") ?? "no .yarnrc.yml").toContain("nodeLinker: node-modules");
    expect(json(p, "package.json").packageManager).toBe("yarn@4.5.0");
    expect(paths(p)).toEqual(sorted([...librarySet(), ".yarnrc.yml"]));
  });

  it("Yarn also gets `.yarnrc.yml`: an app created under `yarn/4.5.0` writes it, and a library under pnpm, npm or bun does not", () => {
    const app = plan({ userAgent: "yarn/4.5.0 npm/? node/v22.15.0" });
    expect(app.files.get(".yarnrc.yml") ?? "no .yarnrc.yml").toContain("nodeLinker: node-modules");
    for (const userAgent of [
      "pnpm/9.12.0 node/v22.15.0",
      "npm/10.9.0 node/v22.15.0",
      "bun/1.2.0 node/v22.15.0",
      undefined,
    ]) {
      const p = plan({ library: "@acme/charts", ...(userAgent === undefined ? {} : { userAgent }) });
      expect(p.files.has(".yarnrc.yml"), String(userAgent)).toBe(false);
    }
  });
});
