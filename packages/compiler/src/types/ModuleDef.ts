import type { JsonValue, PiiClass } from "@keel/schema";

/**
 * A module manifest as declared in `modules/<id>/module.ts` (k.module). `std` (RFC 0047) is this module's config per
 * stdlib package (`@keel/std-*` in `deps`), literal JSON that `keel check` validates (E1158). `clientPii` lists the
 * `.pii()` classes its client-reachable stores may hold, which reach `#k-state` (k.leave Snapshots, E1107).
 */
export type ModuleDef = {
  readonly id: string;
  readonly deps: readonly string[];
  readonly capabilities: readonly string[];
  readonly public: { readonly exports: readonly string[]; readonly routes: readonly string[] };
  readonly std?: Readonly<Record<string, JsonValue>>;
  readonly clientPii?: readonly PiiClass[];
};
