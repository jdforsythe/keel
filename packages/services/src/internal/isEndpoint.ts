import type { Endpoint } from "../Endpoint.ts";

/** Whether a contract entry is an API entry (k.contract): the one kind with a `method`, a `path` and an `output`. */
export function isEndpoint(v: unknown): v is Endpoint {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof Reflect.get(v, "method") === "string" &&
    typeof Reflect.get(v, "path") === "string" &&
    typeof Reflect.get(v, "output") === "object"
  );
}
