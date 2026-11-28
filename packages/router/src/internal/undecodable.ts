import type { KeelError } from "@keel/schema";

/** What a `decodeURIComponent` that threw `x` gives (k.attempt): a path holding a malformed escape matches no route. */
export const undecodable = (x: unknown): KeelError<"keel.notFound", null> | undefined =>
  x instanceof URIError ? { code: "keel.notFound", message: "keel.notFound", data: null } : undefined;
