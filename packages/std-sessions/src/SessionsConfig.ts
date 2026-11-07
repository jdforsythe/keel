import { s } from "@keel/schema";

/**
 * The `std` config of `@keel/std-sessions` per app module (rfc:0066): the module's redaction paths. Registered under
 * the package name at import, so `stdArtifact`, `check` and `createApp({ std })` validate it (E1158; backlog 0203).
 */
export const SessionsConfig = s.object({ redact: s.array(s.string()) }, { closed: true });
export type SessionsConfig = s.infer<typeof SessionsConfig>;
// TODO 0092: client: true (rfc:0069; `redact` must be client-readable once registration takes the opt-in)
s.register("@keel/std-sessions", SessionsConfig);
