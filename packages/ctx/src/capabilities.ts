import { extensions } from "./internal/extensions.ts";
import { kernelNames } from "./internal/kernelNames.ts";

/** Names of every capability a new ctx will carry: the kernel four, then registered ones in order. */
export function capabilities(): string[] {
  return [...kernelNames, ...extensions.keys()];
}
