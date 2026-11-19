import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { handlerUsesIn } from "../internal/handlerUsesIn.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1551 (k.server, k.persist, k.bundle Handlers): a use of `loader` or `action` from `@keel/router`, known by binding
 * however it is imported or re-exported (`handlerUsesIn`), or a `commitStores(...)` call (from `@keel/server`), in an
 * app file not named `*.server.*` (any case). Files under the root's `packages/` are kernel and stdlib code, not app
 * files. No fix: moving the call to its own file is not a one-hunk edit.
 */
const LIBRARY = /^packages\//;

export const loaderInServerFile: RuleDef = {
  code: "E1551",
  message: (f) => `${str(f.data, "name")} outside a *.server.ts file; move it to <name>.server.ts`,
  see: "k.server",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path) || LIBRARY.test(file.path) || /\.server\.[^/]+$/i.test(file.path)) return [];
    const out: Finding[] = [];
    for (const u of handlerUsesIn(file.path, project)) {
      const name = u.kinds.has("loader") ? "loader" : u.kinds.has("action") ? "action" : undefined;
      if (name !== undefined) out.push(findingAt(file, u.start, { name }));
    }
    const commits = localNames(ast, "commitStores", "@keel/server");
    if (commits.size === 0) return out;
    new Visitor({
      CallExpression: (n) => {
        if (n.callee.type === "Identifier" && commits.has(n.callee.name))
          out.push(findingAt(file, n.start, { name: "commitStores" }));
      },
    }).visit(ast);
    return out;
  },
};
