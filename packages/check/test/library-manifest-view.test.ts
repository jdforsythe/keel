// k.library In an app: a registered rule's project holds a library's root `module.ts` at `modules/<id>/module.ts`, so
// a rule that finds a file's module by the `module.ts` whose folder is the longest prefix of the file's path (std-i18n,
// std-messages) finds the library's manifest for each of its `src/` files, and an app module keeps its own.
import { expect, it } from "vitest";
import { check, defineRule } from "../src/index.ts";

const LIB = "node_modules/@acme/status";
const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: [] } })\n`;
const PKG = JSON.stringify({ name: "@acme/status", version: "1.0.0", type: "module", keel: "library", exports: {} });

defineRule({
  code: "E2997",
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

it("a library's src/ file finds its manifest at modules/<id>/module.ts; an app file finds its own", () => {
  const found = check(
    [
      { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/status"]) },
      { path: "modules/shop/page.ts", source: "export const page = 1\n" },
      { path: `${LIB}/package.json`, source: PKG },
      { path: `${LIB}/module.ts`, source: manifest("status", ["@keel/std-messages"]) },
      { path: `${LIB}/src/a.ts`, source: "export const a = 1\n" },
    ],
    { types: false },
  )
    .diagnostics.filter((d) => d.code === "E2997")
    .map((d) => d.path);
  expect(found).toEqual([`${LIB}/src/a.ts`]);
});
