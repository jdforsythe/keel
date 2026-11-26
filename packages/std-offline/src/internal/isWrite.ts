import type { ApiEntry } from "@keel/router/contract";
import { isSchema } from "@keel/schema";

/**
 * Whether a contract entry is an API write entry (std.offline): a `method` other than `GET`, a `path`, an `output`
 * schema and, where present, `params`, `query` and `body` schemas.
 */
export function isWrite(v: unknown): v is ApiEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof Reflect.get(v, "method") === "string" &&
    Reflect.get(v, "method") !== "GET" &&
    typeof Reflect.get(v, "path") === "string" &&
    isSchema(Reflect.get(v, "output")) &&
    (["params", "query", "body"] as const).every((k) => Reflect.get(v, k) === undefined || isSchema(Reflect.get(v, k)))
  );
}
