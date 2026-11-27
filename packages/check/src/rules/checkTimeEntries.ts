import { checkTimeReach } from "../internal/checkTimeReach.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import { projectLibraries } from "../internal/projectLibraries.ts";
import { reachedMessage } from "../internal/reachedMessage.ts";
import { str } from "../internal/str.ts";
import { valueImportSites } from "../internal/valueImportSites.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The entries that run under Node only (k.check-time Entries). */
const ENTRIES: ReadonlySet<string> = new Set(["@keel/ui/tokens", "@keel/ui/css"]);
const NODE_MODULES = /(?:^|\/)node_modules\//;

/**
 * E1818 (k.check-time): a value import, `export ... from` or literal `import()` of `@keel/ui/tokens` or
 * `@keel/ui/css` in a code file of an app or library, at its specifier, unless the file is of an exempt kind and no
 * client entry reaches it (`checkTimeReach`). An exempt-kind file a client entry reaches is reported at the entry's
 * import of the chain's first file, never in a file under `node_modules/`, with `<file> imports <entry>, check and
 * build time only` (`reachedMessage`). No fix.
 */
export const checkTimeEntries: RuleDef = {
  code: "E1818",
  message: (f) => {
    const file = str(f.data, "file");
    const entry = str(f.data, "entry");
    return file === ""
      ? `${entry} is check and build time only; use token names or @keel/ui/brand`
      : reachedMessage(file, entry);
  },
  see: "k.check-time",
  check: ({ file, ast, project }) => {
    const p = file.path;
    if (!isCodePath(p) || /(?:^|\/)\.keel\//.test(p)) return [];
    const library = projectLibraries.get(project)?.files.has(p) === true;
    if (NODE_MODULES.test(p) && !library) return [];
    const sites = valueImportSites(ast).filter((s) => ENTRIES.has(s.spec));
    const read = checkTimeReach(p, project);
    const own = read !== undefined && read.exempt && !read.entry ? [] : sites;
    const out = own.map((s) => findingAt(file, s.start, { entry: s.spec }));
    if (!library && !NODE_MODULES.test(p))
      for (const r of read?.reports ?? []) out.push(findingAt(file, r.start, { entry: r.entry, file: r.file }));
    return out;
  },
};
