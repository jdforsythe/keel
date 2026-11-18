import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1551 (k.server, k.persist): a `loader(...)` or `action(...)` call (imported from `@keel/router`), or a
 * `commitStores(...)` call (from `@keel/server`), in an app file other than `*.server.ts(x)`. Files under the root's
 * `packages/` are kernel and stdlib code, not app files. No fix: moving the call to its own file is not a one-hunk edit.
 */
const LIBRARY = /^packages\//;

export const loaderInServerFile: RuleDef = {
  code: "E1551",
  message: (f) => `${str(f.data, "name")} outside a *.server.ts file; move it to <name>.server.ts`,
  see: "k.server",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || LIBRARY.test(file.path) || /\.server\.[cm]?[jt]sx?$/.test(file.path)) return [];
    const names = new Map<string, string>();
    for (const n of localNames(ast, "loader", "@keel/router")) names.set(n, "loader");
    for (const n of localNames(ast, "action", "@keel/router")) names.set(n, "action");
    for (const n of localNames(ast, "commitStores", "@keel/server")) names.set(n, "commitStores");
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
