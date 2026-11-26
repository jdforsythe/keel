import type { Contract } from "@keel/router/contract";
import { unsafe } from "./unsafe.ts";

/**
 * Read `c` as a contract whose entries are of type `E`, once the caller has compared the entry's members at run time.
 */
export function holds<E extends object>(c: Contract): Contract<string, Readonly<Record<string, E>>> {
  return unsafe(
    "channelRoute compares the entry's own members by identity before this read, so the entry is the channel's entry E",
    () => c as Contract<string, Readonly<Record<string, E>>>,
  );
}
