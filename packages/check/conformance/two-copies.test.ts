// Spec: k.realm, clause "A project whose `node_modules` resolves `@keel/schema` to two folders (the app's and one nested under a dependency) is one E1765 at `package.json` from `keel check` and from `keel build`; with one folder it is none."
// Seed 1337. Fixture projects are in-memory files (package.json files of the app, a dependency and the copies of the kernel package).
// Reading (k.realm, k.check Diagnostics): the message is `two copies of <name> in one realm: <first> and <second>`, the folder the project resolves first, then the one under a dependency, cut from the front to fit 89 units; so each folder is asserted by its tail, and the whole by its length.
// The `keel build` half is packages/cli/conformance/build-two-copies.test.ts.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import type { Files } from "./module-support.ts";

const pkg = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ name, version: "1.0.0", type: "module", ...extra });
const NAMES = ["@keel/schema", "@keel/store", "@keel/router", "@keel/server"] as const;

const project = (name: string, nested: boolean): Files => [
  { path: "package.json", source: pkg("app", { dependencies: { [name]: "1.0.0", dep: "1.0.0" } }) },
  { path: `node_modules/${name}/package.json`, source: pkg(name) },
  { path: "node_modules/dep/package.json", source: pkg("dep", { dependencies: { [name]: "1.0.0" } }) },
  ...(nested ? [{ path: `node_modules/dep/node_modules/${name}/package.json`, source: pkg(name) }] : []),
];
const e1765 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1765");

describe("k.realm One copy: check", () => {
  for (const name of NAMES) {
    it(
      `a project whose node_modules resolves ${name} to two folders is one E1765 at package.json, naming the folder the project resolves first, then the one under a dependency, cut from the front to fit 89 units`,
      () => {
        const ds = e1765(project(name, true));
        expect(ds).toHaveLength(1);
        expect(ds[0]?.path).toBe("package.json");
        const message = ds[0]?.message ?? "";
        expect(message.length).toBeLessThanOrEqual(89);
        expect(message.startsWith(`two copies of ${name} in one realm: `)).toBe(true);
        const [first = "", second = "", ...more] = message.slice(`two copies of ${name} in one realm: `.length).split(" and ");
        expect(more).toEqual([]);
        expect(first.endsWith(`/${name.slice("@keel/".length)}`), message).toBe(true);
        expect(first).not.toContain("dep");
        expect(second.endsWith(`node_modules/${name}`), message).toBe(true);
      },
      testTime(120_000),
    );

    it(
      `with one folder for ${name} there is no E1765`,
      () => {
        expect(e1765(project(name, false))).toEqual([]);
      },
      testTime(120_000),
    );
  }
});
