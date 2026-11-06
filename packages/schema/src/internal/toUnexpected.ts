import type { UnexpectedError } from "./UnexpectedError.ts";
import { clip } from "./clip.ts";

const describeThrown = (thrown: unknown): string => {
  if (thrown instanceof Error) return `${thrown.name}: ${thrown.message}`;
  if (typeof thrown === "string") return thrown;
  try {
    return JSON.stringify(thrown) ?? String(thrown);
  } catch {
    return Object.prototype.toString.call(thrown);
  }
};

/** Turn anything thrown into the `keel.unexpected` KeelError. Never throws. */
export function toUnexpected(thrown: unknown): UnexpectedError {
  const cause = describeThrown(thrown);
  return { code: "keel.unexpected", message: clip(cause, 89), data: { cause } };
}
