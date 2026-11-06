import type { Claim } from "./Claim.ts";
import { Mismatch } from "./Mismatch.ts";
import { nextClaimable } from "./nextClaimable.ts";

/** After a structural op's first render while resuming: leftover server elements are a mismatch. */
export function consumed(claim: Claim): void {
  if (claim.region === null) return;
  const extra = nextClaimable(claim.region);
  if (extra !== null) claim.session.failed ??= new Mismatch("server HTML has content the client did not render");
}
