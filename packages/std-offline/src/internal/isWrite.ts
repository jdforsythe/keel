import type { ApiEntry } from "@keel/router/contract";

/** Whether a contract entry is an API write entry (std.offline): a `method` other than `GET`, a `path` and an `output`. */
export function isWrite(v: unknown): v is ApiEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof Reflect.get(v, "method") === "string" &&
    Reflect.get(v, "method") !== "GET" &&
    typeof Reflect.get(v, "path") === "string" &&
    typeof Reflect.get(v, "output") === "object"
  );
}
