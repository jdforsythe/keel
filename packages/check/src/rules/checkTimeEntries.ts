import { SERVER_ONLY_NAME } from "@keel/compiler/internal";
import { clientEntryReached } from "../internal/clientEntryReached.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { projectLibraries } from "../internal/projectLibraries.ts";
import { str } from "../internal/str.ts";
import { tokensFamily } from "../internal/tokensFamily.ts";
import { valueImportSites } from "../internal/valueImportSites.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The entries that run under Node only (k.themes Check-time entries). */
const ENTRIES: ReadonlySet<string> = new Set(["@keel/ui/tokens", "@keel/ui/css"]);
const CONFIG = /\.config\.[cm]?[jt]sx?$/;

/**
 * E1818 (k.themes Check-time entries): a value import, `export ... from` or literal `import()` of `@keel/ui/tokens` or
 * `@keel/ui/css` in a code file of an app or library, at its specifier; free in a test file and a tool config, and,
 * while no client entry reaches them (`clientEntryReached`), in a server-only file, a project root's `tokens.ts`
 * and the files it imports, and a library's `src/<id>Tokens.ts` (`tokensFamily`). No fix.
 */
export const checkTimeEntries: RuleDef = {
  code: "E1818",
  message: (f) => `${str(f.data, "entry")} is check and build time only; use token names or @keel/ui/brand`,
  see: "k.themes",
  check: ({ file, ast, project }) => {
    const p = file.path;
    if (!isCodePath(p) || isTestPath(p) || CONFIG.test(p) || /(?:^|\/)\.keel\//.test(p)) return [];
    if (/(?:^|\/)node_modules\//.test(p) && projectLibraries.get(project)?.files.has(p) !== true) return [];
    const sites = valueImportSites(ast).filter((s) => ENTRIES.has(s.spec));
    if (sites.length === 0) return [];
    const free = SERVER_ONLY_NAME.test(p) || tokensFamily(p, project);
    if (free && !clientEntryReached(p, project)) return [];
    return sites.map((s) => findingAt(file, s.start, { entry: s.spec }));
  },
};
