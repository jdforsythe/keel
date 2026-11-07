import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1551 (k.server): a `loader(...)` or `action(...)` call (imported from `@keel/router`) in an app file other than
 * `*.server.ts(x)`. No fix: moving the declaration to its own file is not a one-hunk edit.
 */
export const loaderInServerFile: RuleDef = {
  code: "E1551",
  message: (f) => `${str(f.data, "name")} declared outside a *.server.ts file; move it to <name>.server.ts`,
  explain: "Loaders and actions live in *.server.ts files so their code and imports stay on the server.",
  see: "k.server",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || /\.server\.[cm]?[jt]sx?$/.test(file.path)) return [];
    const names = new Map<string, string>();
    for (const n of localNames(ast, "loader", "@keel/router")) names.set(n, "loader");
    for (const n of localNames(ast, "action", "@keel/router")) names.set(n, "action");
    if (names.size === 0) return [];
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        if (n.callee.type !== "Identifier") return;
        const kind = names.get(n.callee.name);
        if (kind !== undefined) out.push(findingAt(file, n.start, { name: kind }));
      },
    }).visit(ast);
    return out;
  },
};
