// k.library Rules E1162 and In an app: a library a library lists is found as Node finds it from the listing library's
// real folder, so a linked one (a workspace package) is held to no ledger file and an installed one is.
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "@keel/check";
import { tempDir } from "@keel/tooling/test-tmp";
import { expect, test } from "vitest";

type File = { path: string; source: string };

const manifest = (id: string, deps: readonly string[]): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: [] } })\n`;
const pkg = (name: string): string => JSON.stringify({ name, version: "1.0.0", type: "module", keel: "library" });

/** Writes `files` under `dir`. */
const write = (dir: string, files: Record<string, string>): void => {
  for (const [rel, source] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), source);
  }
};

/**
 * An app at `<root>/app` whose `shop` module lists `@acme/a`, linked to `<root>/libs/a`, which lists `@acme/b`: linked
 * to `<root>/libs/b` from `a`'s folder, or installed there (`b` a real folder in `a`'s `node_modules`). The app's own
 * `node_modules` holds no `@acme/b`; the files are given as the app reads them, every library at `node_modules/<name>/`.
 */
const e1162 = (installed: boolean): string[] => {
  const root = tempDir("keel-ledger-listed-");
  const app = join(root, "app");
  write(join(root, "libs", "a"), { "package.json": pkg("@acme/a"), "module.ts": manifest("a", ["@acme/b"]) });
  const b = { "package.json": pkg("@acme/b"), "module.ts": manifest("b", []) };
  if (installed) write(join(root, "libs", "a", "node_modules", "@acme", "b"), b);
  else {
    write(join(root, "libs", "b"), b);
    mkdirSync(join(root, "libs", "a", "node_modules", "@acme"), { recursive: true });
    symlinkSync(join(root, "libs", "b"), join(root, "libs", "a", "node_modules", "@acme", "b"));
  }
  mkdirSync(join(app, "node_modules", "@acme"), { recursive: true });
  symlinkSync(join(root, "libs", "a"), join(app, "node_modules", "@acme", "a"));
  const files: File[] = [
    { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/a"]) },
    { path: "node_modules/@acme/a/package.json", source: pkg("@acme/a") },
    { path: "node_modules/@acme/a/module.ts", source: manifest("a", ["@acme/b"]) },
    { path: "node_modules/@acme/b/package.json", source: b["package.json"] },
    { path: "node_modules/@acme/b/module.ts", source: b["module.ts"] },
  ];
  return check(files, { types: false, root: app })
    .diagnostics.filter((d) => d.code === "E1162")
    .map((d) => `${d.path} ${d.message}`);
};

test("a linked library a linked library lists is held to no ledger file", () => {
  expect(e1162(false)).toEqual([]);
});

test("an installed library a linked library lists is held to its ledger file, at the listing entry", () => {
  expect(e1162(true)).toEqual(["node_modules/@acme/a/module.ts @acme/b ships no .keel/ledger.json"]);
});
