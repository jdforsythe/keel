import { Mismatch } from "../internal/Mismatch.ts";
import { claimNext } from "../internal/claimNext.ts";
import { cx } from "../internal/cx.ts";
import { isTag } from "../internal/isTag.ts";
import { nextClaimable } from "../internal/nextClaimable.ts";

/**
 * A `<tag>` element filled by `fill` (base elements, k.ui). While resuming it is the next server element
 * instead, in document order: `fill` runs with that element's child elements as the claim region, so the
 * elements it creates claim them in order, and a server child element left unclaimed is a mismatch (E1253).
 */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  fill: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  const claim = cx.claim;
  if (claim === null) {
    const el = document.createElement(tag);
    fill(el);
    return el;
  }
  const el = claimNext(claim, tag);
  if (!isTag(el, tag)) throw new Mismatch(`<${el.localName}> where the element is <${tag}>`);
  const region = { nodes: [...el.children], pos: 0 };
  cx.claim = { island: null, region, session: claim.session };
  try {
    fill(el);
  } finally {
    cx.claim = claim;
  }
  if (nextClaimable(region) !== null) throw new Mismatch(`<${tag}> has an extra child element`);
  return el;
}
