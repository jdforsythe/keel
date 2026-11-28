import type { KeelError } from "@keel/schema";
import type { RequestScope } from "./RequestScope.ts";
import { redacted } from "./redacted.ts";
import { scrubbedCause } from "./scrubbedCause.ts";

/**
 * An error as a response, a stream line or the dev message may hold it (k.privacy Server log): a `keel.unexpected`
 * with a string `cause` is `scrubbedCause`d, one without has its message `redacted`; every other error is a value the
 * app returned and passes unchanged.
 */
export function scrubbedError(
  e: KeelError<string, unknown>,
  rq: Pick<RequestScope, "pii" | "secrets">,
): KeelError<string, unknown> {
  if (e.code !== "keel.unexpected") return e;
  const cause: unknown = typeof e.data === "object" && e.data !== null ? Reflect.get(e.data, "cause") : undefined;
  if (typeof cause !== "string") return { ...e, message: redacted(e.message, rq) };
  return scrubbedCause({ code: "keel.unexpected", message: e.message, data: { cause } }, rq);
}
