import type { UnexpectedError } from "../types/UnexpectedError.ts";
import { Unexpected } from "./Unexpected.ts";

/** Wrap any thrown value as `keel.unexpected` with `data.at`. */
export function toUnexpected(error: unknown, at: string): UnexpectedError {
  const message = error instanceof Error && error.message !== "" ? error.message : "keel.unexpected";
  return Unexpected.make({ at }, message);
}
