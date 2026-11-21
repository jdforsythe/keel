import type { Claim } from "./Claim.ts";
import { Mismatch } from "./Mismatch.ts";
import { nextClaimable } from "./nextClaimable.ts";

/**
 * The server element the next created `<tag>` claims: the island root or a slot's node (once), else the next
 * element of the current region. Throws Mismatch when there is none; the caller compares its shape.
 */
export function claimNext(claim: Claim, tag: string): Element {
  let el: Element | null;
  if (claim.island !== null) {
    el = claim.island;
    claim.island = null;
  } else if (claim.region !== null) {
    const next = nextClaimable(claim.region);
    if (next === "text") throw new Mismatch(`text where the template has <${tag}>`);
    el = next;
  } else throw new Mismatch(`<${tag}> is not at a resumable position`);
  if (el === null) throw new Mismatch(`missing <${tag}> in server HTML`);
  return el;
}
