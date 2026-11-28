import type { Secret } from "./Secret.ts";
import { listening } from "./internal/listening.ts";
import { secretAccess } from "./internal/secretAccess.ts";

/**
 * The value inside a secret: the only way to read one (k.schema Secrets). Server code only (E1105). Before it opens
 * `secret` it calls the listener slot `secretAccess.of` calls, with the `Secret`, never its value, so the server can scrub
 * the value from the log of the request or runner `run` that reveals it.
 */
export function reveal<T>(secret: Secret<T>): T {
  listening.current?.(secret);
  return secretAccess.open(secret);
}
