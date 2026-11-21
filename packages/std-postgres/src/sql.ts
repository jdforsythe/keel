import type { JsonValue, Schema } from "@keel/schema";
import type { Query } from "./Query.ts";
import { Fragment } from "./internal/Fragment.ts";
import { toParam } from "./internal/toParam.ts";

/**
 * A template tag for statements whose rows are parsed with `schema` (std.postgres). Each `${value}` is a parameter,
 * never text, numbered `$1`, `$2`, ... in template order; a `fragment` value is spliced, its own parameters numbered in
 * place; nothing else is spliced. A parameter that is not a JSON value (a `Secret`, `undefined`, a `Date`, a
 * non-finite number, ...) throws E2457 naming its position.
 */
export function sql<T>(schema: Schema<T, boolean>): (strings: TemplateStringsArray, ...values: unknown[]) => Query<T> {
  return (strings, ...values) => {
    const params: JsonValue[] = [];
    let text = "";
    const splice = (parts: readonly string[], vals: readonly unknown[]): void => {
      for (const [i, part] of parts.entries()) {
        text += part;
        if (i >= vals.length) continue;
        const v = vals[i];
        if (v instanceof Fragment) {
          splice(v.strings, v.values);
          continue;
        }
        params.push(toParam(v, params.length + 1));
        text += `$${params.length}`;
      }
    };
    splice(strings, values);
    return Object.freeze({ text, params: Object.freeze(params), schema });
  };
}
