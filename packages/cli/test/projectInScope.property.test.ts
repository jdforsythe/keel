// projectInScope: the empty scope holds every project; a scope inside a project's folder or a prefix of it holds it.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { projectInScope } from "../src/internal/projectInScope.ts";

const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);

describe("projectInScope", () => {
  it("the empty scope holds every project", () => {
    fc.assert(
      fc.property(name, (pkg) => projectInScope(`packages/${pkg}`, "")),
      { seed: 1337 },
    );
  });
  it("any prefix of the project folder, and any path inside it, holds it", () => {
    fc.assert(
      fc.property(name, fc.nat(40), name, (pkg, n, rest) => {
        const dir = `packages/${pkg}/`;
        expect(projectInScope(`packages/${pkg}`, dir.slice(0, Math.min(n, dir.length)))).toBe(true);
        expect(projectInScope(`packages/${pkg}`, `${dir}src/${rest}`)).toBe(true);
      }),
      { seed: 1337 },
    );
  });
  it("an app item scope, or another project's folder, holds none", () => {
    expect(projectInScope("packages/cli", "golden-2:")).toBe(false);
    expect(projectInScope("packages/cli", "packages/server/")).toBe(false);
    expect(projectInScope("packages/cli", "packages/cli/src/a.ts")).toBe(true);
    expect(projectInScope("apps/golden-1", "apps/golden-1/modules/")).toBe(true);
    expect(projectInScope(".", "packages/cli/")).toBe(true);
  });
});
