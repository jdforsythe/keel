// packageInScope: the empty scope holds every package; a scope inside a package's directory or a prefix of it holds it.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { packageInScope } from "../src/internal/packageInScope.ts";

const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);

describe("packageInScope", () => {
  it("the empty scope holds every package", () => {
    fc.assert(
      fc.property(name, (pkg) => packageInScope(pkg, "")),
      { seed: 1337 },
    );
  });
  it("any prefix of the package directory, and any path inside it, holds it", () => {
    fc.assert(
      fc.property(name, fc.nat(40), name, (pkg, n, rest) => {
        const dir = `packages/${pkg}/`;
        expect(packageInScope(pkg, dir.slice(0, Math.min(n, dir.length)))).toBe(true);
        expect(packageInScope(pkg, `${dir}src/${rest}`)).toBe(true);
      }),
      { seed: 1337 },
    );
  });
  it("an app scope, or another package's directory, holds none", () => {
    expect(packageInScope("cli", "golden-2:")).toBe(false);
    expect(packageInScope("cli", "packages/server/")).toBe(false);
    expect(packageInScope("cli", "packages/cli/src/a.ts")).toBe(true);
  });
});
