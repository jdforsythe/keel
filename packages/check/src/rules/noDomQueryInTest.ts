import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const DOM: ReadonlySet<string> = new Set([
  "querySelector",
  "querySelectorAll",
  "getElementById",
  "getElementsByClassName",
  "getElementsByTagName",
  "getElementsByName",
  "container",
]);
const QUERY = /^(?:get|getAll|query|queryAll|find|findAll)By[A-Z]\w*$/;
const isQuery = (name: string): boolean => DOM.has(name) || QUERY.test(name);

/** E1701 (k.testing): a DOM selector or DOM query in a test; tests address elements by id (`find(id)`). */
export const noDomQueryInTest: RuleDef = {
  code: "E1701",
  message: (f) => `DOM query ${str(f.data, "name")} in a test; address elements by id with find(id)`,
  explain: "Tests address elements by stable id only: t.find('cart.total'), t.fire(id, event). No DOM queries.",
  see: "k.testing",
  check: ({ file, ast }) => {
    if (!isTestPath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      MemberExpression: (n) => {
        if (!n.computed && isQuery(n.property.name))
          out.push(findingAt(file, n.property.start, { name: n.property.name }));
      },
      CallExpression: (n) => {
        if (n.callee.type === "Identifier" && QUERY.test(n.callee.name))
          out.push(findingAt(file, n.callee.start, { name: n.callee.name }));
      },
    }).visit(ast);
    return out;
  },
};
