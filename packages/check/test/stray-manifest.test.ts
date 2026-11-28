// k.module Manifest: a `module.ts` is a manifest only at `modules/<id>/module.ts` of an app and at a library's root. One
// deeper in a module folder or under a library's `src/` or `unsafe/` is E1171, and no rule's project holds it, so it
// cannot stand in for the module's manifest where a rule finds a file's module by the longest `module.ts` folder prefix.
import { expect, it } from "vitest";
import { check, defineRule } from "../src/index.ts";

const LIB = "node_modules/@acme/status";
const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: [] } })\n`;
const PKG = JSON.stringify({ name: "@acme/status", version: "1.0.0", type: "module", keel: "library", exports: {} });

defineRule({
  code: "E2996",
  message: "module lists std-messages",
  explain: "Fixture rule: reports a file whose module (the longest-prefix manifest) lists @keel/std-messages.",
  check: ({ file, project }) => {
    if (file.path.endsWith("module.ts")) return [];
    let best: { path: string; source: string } | undefined;
    for (const f of project) {
      if (!f.path.endsWith("module.ts")) continue;
      const root = f.path.slice(0, -"module.ts".length);
      if (file.path.startsWith(root) && (best === undefined || f.path.length > best.path.length)) best = f;
    }
    return best?.source.includes("@keel/std-messages") === true ? [{ path: file.path, line: 1, col: 1 }] : [];
  },
});

const run = (files: Record<string, string>) =>
  check(
    Object.entries(files).map(([path, source]) => ({ path, source })),
    { types: false },
  )
    .diagnostics.filter((d) => d.code === "E2996" || d.code === "E1171")
    .map((d) => `${d.code} ${d.path}`);

it("a library's src/fmt/module.ts is E1171 and its files keep the root manifest", () => {
  expect(
    run({
      "modules/shop/module.ts": manifest("shop", ["@acme/status"]),
      [`${LIB}/package.json`]: PKG,
      [`${LIB}/module.ts`]: manifest("status", ["@keel/std-messages"]),
      [`${LIB}/src/fmt/module.ts`]: manifest("status", []),
      [`${LIB}/src/fmt/fmt.ts`]: "export const fmt = 1\n",
      [`${LIB}/unsafe/module.ts`]: manifest("status", []),
      [`${LIB}/unsafe/u.ts`]: "export const u = 1\n",
    }),
  ).toEqual([
    `E2996 ${LIB}/src/fmt/fmt.ts`,
    `E1171 ${LIB}/src/fmt/module.ts`,
    `E1171 ${LIB}/unsafe/module.ts`,
    `E2996 ${LIB}/unsafe/u.ts`,
  ]);
});

it("an app's modules/a/sub/module.ts is E1171 and the files beside it keep modules/a/module.ts", () => {
  expect(
    run({
      "modules/a/module.ts": manifest("a", ["@keel/std-messages"]),
      "modules/a/sub/module.ts": manifest("a", []),
      "modules/a/sub/x.ts": "export const x = 1\n",
    }),
  ).toEqual(["E1171 modules/a/sub/module.ts", "E2996 modules/a/sub/x.ts"]);
});

it("a manifest where one belongs is no E1171", () => {
  expect(
    run({
      "modules/a/module.ts": manifest("a", []),
      "modules/a/x.ts": "export const x = 1\n",
      [`${LIB}/package.json`]: PKG,
      [`${LIB}/module.ts`]: manifest("status", []),
      [`${LIB}/src/a.ts`]: "export const a = 1\n",
    }),
  ).toEqual([]);
});

it("E1171's message fits 89 units and names where a manifest belongs", () => {
  const d = check(
    [
      { path: "modules/a/module.ts", source: manifest("a", []) },
      { path: "modules/a/sub/module.ts", source: manifest("a", []) },
    ],
    { types: false },
  ).diagnostics.find((x) => x.code === "E1171");
  expect(d?.message).toBe("this module.ts is no manifest; modules/<id>/ or a library's root holds the manifest");
  expect(d?.message.length).toBeLessThanOrEqual(89);
  expect([d?.line, d?.col]).toEqual([1, 1]);
});
