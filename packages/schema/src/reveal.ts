import { Secret } from "./Secret.ts";

/** The value inside a secret: the only way to read one (k.schema Secrets). Server code only (E1105). */
export function reveal<T>(secret: Secret<T>): T {
  return Secret.open(secret);
}
