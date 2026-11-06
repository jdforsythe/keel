import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";
import { guardTable } from "./internal/guardTable.ts";
import type { Guard } from "./types/Guard.ts";

/**
 * Declare and register guard `name` (k.router Guards). Routes name it in `guard`; on `err` (`keel.denied`)
 * navigation redirects to route `redirect` with search `{ next: url }`. Re-declaring a name replaces the
 * guard (module re-evaluation); guards resolve by name at navigation time.
 */
export function guard(
  name: string,
  opts: { readonly redirect: string },
  fn: (req: { readonly url: string }, ctx: Ctx) => Promise<Result<null, KeelError<"keel.denied", unknown>>>,
): Guard {
  const g: Guard = Object.freeze({ kind: "keel.guard", name, redirect: opts.redirect, run: fn });
  guardTable.set(name, g);
  return g;
}
