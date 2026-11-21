import type { CaughtError } from "../types/CaughtError.ts";
import { InvalidThrow } from "./InvalidThrow.ts";
import { Unexpected } from "./Unexpected.ts";

/** What a Boundary's fallback gets for a throw: a host element's `schema.invalid` as raised, else `keel.unexpected` with `data.at`. */
export function toCaught(error: unknown, at: string): CaughtError {
  if (error instanceof InvalidThrow) return error.error;
  const message = error instanceof Error && error.message !== "" ? error.message : "keel.unexpected";
  return Unexpected.make({ at }, message);
}
