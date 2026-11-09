import { clientStd } from "@keel/compiler/std/clientStd";
import { s } from "@keel/schema";

/**
 * The `std` config of `@keel/std-sessions` per app module (rfc:0070): `redact` and `expose` entries
 * (`<subject>:<target>#<path>`) and `readers`, the caller hashes `sessions.list` answers. Registered under the package
 * name at import, so `stdArtifact`, `check` and `createApp({ std })` validate it (E1158).
 */
export const SessionsConfig = s.object(
  {
    redact: s.array(s.string()).optional(),
    expose: s.array(s.string()).optional(),
    readers: s.array(s.string()).optional(),
  },
  { closed: true },
);
export type SessionsConfig = s.infer<typeof SessionsConfig>;
s.register("@keel/std-sessions", SessionsConfig);
clientStd("@keel/std-sessions", ["redact"]);
