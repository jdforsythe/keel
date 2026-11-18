// Project trees for the E1759 suites (not a test file). Public API only. Seed 1337 for every property.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import type { Files } from "./support.ts";

export type Diag = ReturnType<typeof check>["diagnostics"][number];
export type Adapter = "node" | "client" | "static";

export const NO_TYPES = { types: false } as const;

const f = (path: string, source: string): Files[number] => ({ path, source });

const manifest = (id: string): Files[number] =>
  f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`,
  );

/** `topology.ts` declaring each deployable as `name: { modules, adapter }`. */
export const topology = (decls: Record<string, { modules: string[]; adapter: Adapter }>): Files[number] =>
  f(
    "topology.ts",
    `import { topology } from '@keel/server'\nexport default topology({ ${Object.entries(decls)
      .map(
        ([name, d]) => `${name}: { modules: [${d.modules.map((m) => `'${m}'`).join(", ")}], adapter: '${d.adapter}' }`,
      )
      .join(", ")} })\n`,
  );

/** Module `shop` served by one deployable of `adapter`, plus `extra` files. */
export const shop = (adapter: Adapter, extra: Files = []): Files => [
  topology({ web: { modules: ["shop"], adapter } }),
  manifest("shop"),
  ...extra,
];

/** Module `shop` served by one `node` and one `client` deployable, plus `extra` files. */
export const shopBoth = (extra: Files = []): Files => [
  topology({ api: { modules: ["shop"], adapter: "node" }, web: { modules: ["shop"], adapter: "client" } }),
  manifest("shop"),
  ...extra,
];

/** No `topology.ts`: the files alone. */
export const bare = (extra: Files): Files => extra;

export const file = f;

/** The E1759 diagnostics of `files`. */
export const e1759 = (files: Files): Diag[] => check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1759");

/** Source of a module-level `export const v = <expr>` (a read) or a statement (an import or re-export). */
export const asSource = (stmt: string): string =>
  /^(import|export) /.test(stmt) ? `${stmt}\n` : `export const v = ${stmt}\n`;

/** Writes `files` to a fresh directory, `git apply`s `fix` there and returns the patched files. */
export function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-e1759-"));
  try {
    for (const file of files) {
      mkdirSync(dirname(join(dir, file.path)), { recursive: true });
      writeFileSync(join(dir, file.path), file.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((file) => ({ path: file.path, source: readFileSync(join(dir, file.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SKIP = new Set(["node_modules", "dist", "coverage", "reports", "deploy", "public", ".keel", "test"]);

/** The app's own `.ts` and `.tsx` files (topology, tokens, config, modules), as project files rooted at the app. */
export function realApp(app: string): Files {
  const out: Files[number][] = [];
  const walk = (rel: string): void => {
    for (const e of readdirSync(join(ROOT, app, rel), { withFileTypes: true })) {
      const next = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(next);
      } else if (/\.tsx?$/.test(e.name)) out.push(f(next, readFileSync(join(ROOT, app, next), "utf8")));
    }
  };
  walk("");
  return out;
}
