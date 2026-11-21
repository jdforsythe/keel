import { findingAt } from "../internal/findingAt.ts";
import { hostCodeFiles } from "../internal/hostCodeFiles.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { moduleSpecifiers } from "../internal/moduleSpecifiers.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** A specifier naming a stylesheet, a query aside. */
const CSS = /\.css(?:\?.*)?$/;

/**
 * E1825 (k.host-code): a `.css` specifier (an import, a re-export, a literal `import()` or `require()`) in an app file
 * that is not a host element code file, one a `Host`'s `code` prop in the project imports (`hostCodeFiles`). One
 * finding per statement or call. No fix: the stylesheet belongs to the host element's code.
 */
export const stylesheetImport: RuleDef = {
  code: "E1825",
  message: "stylesheet imported outside a host element code file; import it from the Host's code",
  see: "k.host-code",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path) || !file.source.includes(".css")) return [];
    const hits = moduleSpecifiers(ast, true).filter((m) => CSS.test(m.spec));
    if (hits.length === 0 || hostCodeFiles(project).has(file.path)) return [];
    return hits.map((m) => findingAt(file, m.at));
  },
};
