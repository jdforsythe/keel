// Seed 1337 (no generated input). The package's own server sources, given to `check` under an app path, have no
// E1112; `reveal(` appears once in `src/`.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { check } from "@keel/check";
import { expect, test } from "vitest";

const SRC = join(import.meta.dirname, "..", "src");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  );

test("the server sources under an app path have no E1112", () => {
  const server = filesUnder(join(SRC, "server"));
  expect(server.length).toBeGreaterThan(10);
  const files = [
    {
      path: "modules/app/module.ts",
      source: `import { module } from "@keel/compiler"\nexport default module({ id: "app", deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`,
    },
    ...server.map((f) => ({
      path: `modules/app/${relative(join(SRC, "server"), f).replace(/\.ts$/, ".server.ts")}`,
      source: readFileSync(f, "utf8"),
    })),
  ];
  const found = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1112");
  expect(found).toEqual([]);
});

test("`reveal(` appears once in src/", () => {
  const count = filesUnder(SRC)
    .map((f) => readFileSync(f, "utf8").split("reveal(").length - 1)
    .reduce((a, b) => a + b, 0);
  expect(count).toBe(1);
});
