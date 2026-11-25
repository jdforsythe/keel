// Not a test file. Project roots for the package-factory read (k.privacy-reads Factories), through `keel check`'s E1107 (k.leave). Public API only.
import { check } from "@keel/check";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { file, topologyOf } from "./boundary-support.ts";
import { freshDir, linkAt, removeDir, rootOption, writeFileAt, writeTree } from "./security-support.ts";
import type { Files } from "./support.ts";

export const CLASSES = [
  "name",
  "contact",
  "location",
  "identifier",
  "financial",
  "special",
  "network",
  "content",
] as const;

/** `module a`'s manifest, with a `clientPii` when given. */
export const manifestWith = (clientPii?: readonly string[]): Files[number] =>
  file(
    "modules/a/module.ts",
    `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] }${
      clientPii === undefined ? "" : `, clientPii: [${clientPii.map((c) => `'${c}'`).join(", ")}]`
    } })\n`,
  );

/** `modules/a/Page.tsx` of a `node` module: `head` (imports and helpers), then the `store` call over `schemaExpr`. */
export const pageFiles = (head: string, schemaExpr: string, clientPii?: readonly string[]): Files => [
  topologyOf({ api: { modules: ["a"], adapter: "node" } }),
  manifestWith(clientPii),
  file(
    "modules/a/Page.tsx",
    `import { store } from '@keel/store'\nimport { s } from '@keel/schema'\n${head}\nexport const c = store(${schemaExpr}, {})\n`,
  ),
];

export const packageJson = (name: string, entry: string): string =>
  `${JSON.stringify({ name, version: "1.0.0", type: "module", exports: { ".": entry } })}\n`;

/** E1107 diagnostics of `files` checked in a root where each `packages` entry (name to `index.ts` source) is `node_modules/<name>`, and each `extra` entry (path to source) is a file there. */
export function e1107In(
  files: Files,
  packages: Record<string, string>,
  extra: Record<string, string> = {},
  links: Record<string, string> = {},
) {
  const dir = freshDir("keel-fac");
  try {
    writeTree(dir, files);
    for (const [name, source] of Object.entries(packages)) {
      writeFileAt(dir, `node_modules/${name}/package.json`, packageJson(name, "./index.ts"));
      writeFileAt(dir, `node_modules/${name}/index.ts`, source);
    }
    for (const [path, source] of Object.entries(extra)) writeFileAt(dir, path, source);
    for (const [path, target] of Object.entries(links)) linkAt(dir, path, target);
    writeFileAt(dir, "package.json", '{"name":"app","type":"module"}\n');
    return check(files, { root: rootOption(dir), types: false }).diagnostics.filter((d) => d.code === "E1107");
  } finally {
    removeDir(dir);
  }
}

/** The real folder of a workspace package, to link as a `node_modules` entry. */
export const workspacePackage = (folder: string): string => realpathSync(join(import.meta.dirname, "..", "..", folder));

export const holds = (classes: string): string =>
  `store state reaching #k-state holds .pii('${classes}'), not in clientPii`;
export const notReadable = (part: string): string =>
  `store state not readable at ${part}; cannot show its .pii() classes`;
