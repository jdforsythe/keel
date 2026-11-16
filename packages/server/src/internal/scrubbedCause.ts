import type { KeelError } from "@keel/schema";
import type { RequestScope } from "./RequestScope.ts";
import { redacted } from "./redacted.ts";

type Thrown = KeelError<"keel.unexpected", { readonly cause: string }>;

/**
 * A thrown `keel.unexpected` without the request's `.pii()` values and revealed secrets (k.privacy Server log):
 * `cause` scrubbed (`redacted`), and the message clipped again from it (89 characters, as `attempt` clips), so no
 * clipped half of a value survives.
 */
export function scrubbedCause(e: Thrown, rq: Pick<RequestScope, "pii" | "secrets">): Thrown {
  const cause = redacted(e.data.cause, rq);
  return { ...e, message: cause.length <= 89 ? cause : `${cause.slice(0, 88)}…`, data: { cause } };
}
