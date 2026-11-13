import type { KeelError } from "@keel/schema";
import { scrubbed } from "./scrubbed.ts";

type Thrown = KeelError<"keel.unexpected", { readonly cause: string }>;

/**
 * A thrown `keel.unexpected` without the request's `.pii()` values (k.privacy Server log): `cause` scrubbed, and the
 * message clipped again from it (89 characters, as `attempt` clips), so no clipped half of a value survives.
 */
export function scrubbedCause(e: Thrown, values: ReadonlySet<string>): Thrown {
  const cause = scrubbed(e.data.cause, values);
  return { ...e, message: cause.length <= 89 ? cause : `${cause.slice(0, 88)}…`, data: { cause } };
}
