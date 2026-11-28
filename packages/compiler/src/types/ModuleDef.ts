import type { JsonValue, PiiClass } from "@keel/schema";

/**
 * A module manifest as declared in `modules/<id>/module.ts` (k.module). `std` (RFC 0047) is this module's config per
 * stdlib package (`@keel/std-*` in `deps`), literal JSON that `keel check` validates (E1158). `clientPii` lists the
 * `.pii()` classes its client-reachable stores may hold, which reach `#k-state` (k.leave Snapshots, E1107). `env` names
 * the environment variables its server code reads, which `deploy/compose.yaml` passes (k.server-deps Environment).
 */
export type ModuleDef = {
  readonly id: string;
  readonly deps: readonly string[];
  readonly capabilities: readonly string[];
  readonly public: { readonly exports: readonly string[] };
  readonly std?: Readonly<Record<string, JsonValue>>;
  readonly clientPii?: readonly PiiClass[];
  readonly env?: readonly string[];
};
