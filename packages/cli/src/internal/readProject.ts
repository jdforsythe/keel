import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
/** A project of the ledger (k.ledger-items Projects): the folder itself, or `packages/<p>`, `apps/<a>`, `examples/<e>`. */
const PROJECT = "(?:(?:packages|apps|examples)\\/[^/]+\\/)?";
/** Each project's Stryker report and run reports, read by `ledger` only: the walk enters `reports` only on the path to them. */
const PROJECT_REPORT = new RegExp(`^${PROJECT}reports\\/(?:mutation\\/mutation|tests\\/[^/]+)\\.json$`);
/** A project's justified survivors (k.ledger Justified survivors) and the `package.json` that makes a folder a project. */
const PROJECT_FILE =
  /^(?:(?:packages|apps|examples)\/[^/]+\/)?mutation-justified\.json$|^(?:packages|apps|examples)\/[^/]+\/package\.json$/;
const TO_REPORT = new RegExp(`^${PROJECT}reports(?:\\/mutation|\\/tests)?$`);
/** A project's render checks (k.a11y Claims), read by `ledger` only; the walk enters any `reports` directory for it. */
const A11Y_REPORT = /(?:^|\/)reports\/a11y\.json$/;
const TO_A11Y = /(?:^|\/)reports$/;

/**
 * Binary only: read the project under `cwd` into engine files. `query` (check, spec, test): code, each module's
 * `migrations/*.sql`, spec markdown, `.keel` artifacts, generated deploy files and the `package.json` and `index.html` (W1012) beside each `topology.ts` of every project under `cwd`, and the ledger. `ledger`: `query` plus, per project (k.ledger-items Projects), its `package.json`, `reports/mutation/mutation.json`, `reports/tests/*.json` and `mutation-justified.json`, and each project's `reports/a11y.json`.
 * `tree` (scaffold, codemod, build): every text file under 1 MB,
 * since structural operations read manifests, `package.json`, `turbo.json` and CI files too.
 */
export function readProject(cwd: string, scope: "query" | "ledger" | "tree"): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  const want = (rel: string, abs: string): boolean =>
    scope === "tree"
      ? TEXT.test(rel) && statSync(abs).size <= MAX_BYTES
      : QUERY(rel) ||
        (/(?:^|\/)(?:package\.json|index\.html)$/.test(rel) && existsSync(join(abs, "..", "topology.ts"))) ||
        (scope === "ledger" && (PROJECT_REPORT.test(rel) || PROJECT_FILE.test(rel) || A11Y_REPORT.test(rel)));
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
  return out;
}
