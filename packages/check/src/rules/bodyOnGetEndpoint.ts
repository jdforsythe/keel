import { endpointLiterals } from "../internal/endpointLiterals.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { removeProperty } from "../internal/removeProperty.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1653 (k.services): `body` declared on an endpoint whose literal `method` is `GET` or `HEAD`. Reported at the
 * `body` property; the fix removes it.
 */
export const bodyOnGetEndpoint: RuleDef = {
  code: "E1653",
  message: (f) => `body on ${str(f.data, "method")} endpoint; use params or query, or POST`,
  explain: "GET and HEAD requests carry no body; declare the data as params or query, or use a body method.",
  see: "k.services",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    for (const { obj } of endpointLiterals(ast)) {
      const method = propertyOf(obj, "method")?.value;
      if (method?.type !== "Literal" || typeof method.value !== "string") continue;
      const verb = method.value.toUpperCase();
      const body = propertyOf(obj, "body");
      if (body === null || (verb !== "GET" && verb !== "HEAD")) continue;
      out.push(findingAt(file, body.start, { method: verb, start: body.start }));
    }
    return out;
  },
  fix: (f, { ast }) => {
    const start = num(f.data, "start");
    for (const { obj } of endpointLiterals(ast)) {
      const body = propertyOf(obj, "body");
      if (body?.start !== start) continue;
      const edit = removeProperty(obj, body);
      return edit === null ? null : [edit];
    }
    return null;
  },
};
