import { type Finding, type RuleDef, defineRule } from "@keel/check";
import type { At } from "./internal/At.ts";
import { callsOf } from "./internal/callsOf.ts";
import { follow } from "./internal/follow.ts";
import { holdsSecretCall } from "./internal/holdsSecretCall.ts";
import { lineCol } from "./internal/lineCol.ts";

const get = (n: unknown, k: string): unknown => (typeof n === "object" && n !== null ? Reflect.get(n, k) : undefined);
const list = (n: unknown): unknown[] => {
  const v = get(n, "properties") ?? get(n, "arguments");
  return Array.isArray(v) ? v : [];
};

/** Whether the entries at `at` (a `contract(module, {...})` call or an object literal) have a body holding `s.secret`. */
function secretBody(at: At, project: Parameters<RuleDef["check"]>[0]["project"]): boolean {
  const map = follow(at, project);
  const obj = get(map.node, "type") === "CallExpression" ? follow({ ...map, node: list(map.node)[1] }, project) : map;
  return list(obj.node).some((p) => {
    const e = follow({ ...obj, node: get(p, "value") }, project);
    const body = list(e.node).find(
      (q) => get(get(q, "key"), "name") === "body" || get(get(q, "key"), "value") === "body",
    );
    return body !== undefined && holdsSecretCall(follow({ ...e, node: get(body, "value") }, project).node);
  });
}

/**
 * E2651 (std.offline, k.check registry): an `outbox` whose contract, inline, a `const` of the same file or one
 * imported from a project file, has an entry body holding `s.secret`. Entries are stored in the browser. No fix;
 * `outbox` also throws it.
 */
export const secretOutboxBody: RuleDef = defineRule({
  code: "E2651",
  see: "std.offline",
  message: "outbox entry body holds s.secret; outbox entries are stored in the browser",
  explain:
    "An outbox keeps each write's input in the browser's storage until it is sent, so no entry body it sends holds a " +
    "secret. Fix: send an id the action reads it by: body: s.object({ cardId: s.id('Card'), write: Write }).",
  check: ({ file, ast, project }): Finding[] =>
    callsOf(ast, "@keel/std-offline", "outbox").flatMap((c) => {
      const api = c.arguments[1];
      return api !== undefined && secretBody({ node: api, file, ast }, project)
        ? [{ path: file.path, ...lineCol(file.source, api.start) }]
        : [];
    }),
});
