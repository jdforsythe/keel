import type { Identity } from "./types/Identity.ts";

/**
 * Declare the project's identity source (k.user): `identity.server.ts` default-exports it and each `node` deployable's
 * generated entry passes it as `createApp({ identity })`. Keel calls `identify` and mounts `handle`; it never reads,
 * writes or stores a credential, session or token. `createApp` checks `handle.path` (E1579).
 */
export function identity(def: Identity): Identity {
  return Object.freeze({ ...def });
}
