import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { projectDirs } from "@keel/compiler";
import { libraryFiles } from "@keel/compiler/std/libraryFiles";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";

const SKIP = new Set(["node_modules", "dist", "coverage", "reports", ".turbo", ".git", ".worktrees"]);
const TEXT = /\.(?:[cm]?[jt]sx?|json|md|ya?ml|css|html|txt|rs|toml)$|(?:^|\/)Dockerfile$/;
const MAX_BYTES = 1_000_000;
/** Build configuration is tooling, type-checked by the project's own tsc, not app code for `keel check`. */
const BUILD_CONFIG = /(?:^|\/)(?:vite|vitest|stryker)\.config\.[cm]?[jt]s$/;
/** A compiler artifact, `<dir>/.keel/<name>.json` at any depth: each project of a workspace has its own (rfc:0055). */
const ARTIFACT = /(?:^|\/)\.keel\/[^/]+\.json$/;
/**
 * Generated deploy files and what decides which exist and what they hold (k.deploy Deploy files): `keel check`
 * compares them (E1005). A `package.json` beside a `topology.ts` gives a shell its version.
 */
const DEPLOY = /(?:^|\/)(?:deploy\/(?:[^/]+\/Dockerfile|compose\.yaml)|\.github\/workflows\/ci\.yml|turbo\.json)$/;
/** A text file in a shell's folder (k.shell Files): its target decides which are generated. */
const SHELL_FILE = /(?:^|\/)deploy\/[^/]+\/(?:capacitor|tauri)\//;
/** A module's migration (std.postgres): rules with a `sql` reader check it (k.check Registry). */
const MIGRATION = /(?:^|\/)modules\/[^/]+\/migrations\/[^/]+\.sql$/;
const QUERY = (rel: string): boolean =>
  (CODE_FILE.test(rel) && !BUILD_CONFIG.test(rel)) ||
  MIGRATION.test(rel) ||
  (rel.startsWith("spec/") && rel.endsWith(".md")) ||
  ARTIFACT.test(rel) ||
  DEPLOY.test(rel) ||
  (SHELL_FILE.test(rel) && TEXT.test(rel)) ||
  rel === "tooling/ledger/ledger.json";
/** Stryker reports, read by `ledger` only: the walk enters `reports` only on the path to them. */
const MUTATION_REPORT = /^packages\/[^/]+\/reports\/mutation\/mutation\.json$/;
/** A package's justified survivors (k.ledger Justified survivors), read by `ledger` only. */
const MUTATION_JUSTIFIED = /^packages\/[^/]+\/mutation-justified\.json$/;
const TO_REPORT = /^packages\/[^/]+\/reports(?:\/mutation)?$/;
/** A project's render checks (k.a11y Claims), read by `ledger` only; the walk enters any `reports` directory for it. */
const A11Y_REPORT = /(?:^|\/)reports\/a11y\.json$/;
const TO_A11Y = /(?:^|\/)reports$/;

/**
 * Binary only: read the project under `cwd` into engine files. `query` (check, spec, test): code, each module's
 * `migrations/*.sql`, spec markdown, `.keel` artifacts, generated deploy files and the `package.json` and `index.html` (W1012) beside each `topology.ts` of every project under `cwd`, and the ledger. `ledger`: `query` plus `packages/<pkg>/reports/mutation/mutation.json`, `packages/<pkg>/mutation-justified.json` and each project's `reports/a11y.json`.
 * `tree` (scaffold, codemod, build): every text file under 1 MB,
 * since structural operations read manifests, `package.json`, `turbo.json` and CI files too.
 * `query` and `ledger` also hold the files of each library the project's manifests reach (`libraryFiles`, kind `library`; k.library
 * In an app), read from its real folder and placed at `<p>node_modules/<name>/`, `<p>` the project dir whose manifests
 * list it: its `package.json`, its root `module.ts` and the code files under its `src/` and `unsafe/`.
 */
export function readProject(cwd: string, scope: "query" | "ledger" | "tree"): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  const want = (rel: string, abs: string): boolean =>
    scope === "tree"
      ? TEXT.test(rel) && statSync(abs).size <= MAX_BYTES
      : QUERY(rel) ||
        (/(?:^|\/)(?:package\.json|index\.html)$/.test(rel) && existsSync(join(abs, "..", "topology.ts"))) ||
        (scope === "ledger" && (MUTATION_REPORT.test(rel) || MUTATION_JUSTIFIED.test(rel) || A11Y_REPORT.test(rel)));
  const walk = (dir: string, rel: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP.has(e.name) || (scope === "ledger" && (TO_REPORT.test(r) || TO_A11Y.test(r)))) walk(abs, r);
      } else if (e.isFile() && want(r, abs)) out.push({ path: r, source: readFileSync(abs, "utf8") });
    }
  };
  walk(cwd, "");
  return scope === "tree" ? out : [...out, ...libraries(cwd, out)];
}

/** The files of the libraries each project of `files` reaches, placed under its `node_modules/` (`readProject`). */
function libraries(
  cwd: string,
  files: readonly { path: string; source: string }[],
): { path: string; source: string }[] {
  const out = new Map<string, string>();
  const dirs = projectDirs(files);
  for (const dir of dirs) {
    const own = files
      .filter((f) => f.path.startsWith(dir) && dirs.find((d) => f.path.startsWith(d)) === dir)
      .map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    for (const lib of libraryFiles(join(cwd, dir), own)) {
      if (lib.kind !== "library") continue;
      const at = `${dir}node_modules/${lib.name}/`;
      const add = (abs: string): void => {
        const rel = relative(lib.dir, abs).split(sep).join("/");
        if (!out.has(`${at}${rel}`) && existsSync(abs)) out.set(`${at}${rel}`, readFileSync(abs, "utf8"));
      };
      add(join(lib.dir, "package.json"));
      if (lib.manifest !== undefined) out.set(`${at}module.ts`, lib.manifest);
      for (const f of lib.files) if (CODE_FILE.test(f)) add(f);
    }
  }
  return [...out].map(([path, source]) => ({ path, source }));
}
