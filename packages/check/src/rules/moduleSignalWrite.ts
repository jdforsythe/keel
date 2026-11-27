import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { moduleState } from "../internal/moduleState.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const LIBRARY = /^packages\//;

/**
 * E1256 at check (k.shared At check): in server code (a `*.server.ts` file, or one that calls `loader`, `action` or
 * `guard`), a call of `set`, inside a function, on a top-level binding of a module (this file's, or one import away in
 * the project) made by `@keel/reactive`'s `signal` or typed `Signal`, at the call. A name a function encloses as its
 * own is not that binding. Files under the root's `packages/` are kernel and stdlib code, not app files. No fix: where
 * the state belongs is the author's choice (k.fixes).
 */
export const moduleSignalWrite: RuleDef = {
  code: "E1256",
  message: (f) =>
    `module signal ${str(f.data, "name")} set in server code: keep per-request state in the request scope`,
  see: "k.shared",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path) || LIBRARY.test(file.path)) return [];
    const m = moduleState(file, ast, project);
    if (!m.server) return [];
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type !== "MemberExpression" || c.computed || c.property.type !== "Identifier") return;
        if (c.property.name !== "set" || c.object.type !== "Identifier") return;
        const name = c.object.name;
        if (!m.inFunction(n.start) || m.shadowed(name, n.start) || !m.moduleSignal(name)) return;
        out.push(findingAt(file, n.start, { name }));
      },
    }).visit(ast);
    return out;
  },
};
