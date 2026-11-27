import { attempt } from "@keel/schema";
import { Rejected } from "../../internal/Rejected.schema.ts";
/** `member` applied, failing closed: a throw is a denial. */
export function allowed<A>(member: (at: A) => boolean, at: A): boolean {
  const asked = attempt(
    () => member(at) === true,
    (x) => (x instanceof Error ? Rejected.make({}) : undefined),
  );
  return asked.ok && asked.value;
}
