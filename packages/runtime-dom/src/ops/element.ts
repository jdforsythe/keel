import { isTag } from "../../unsafe/isTag.ts";
import { Mismatch } from "../internal/Mismatch.ts";
import { claimNext } from "../internal/claimNext.ts";
import { cx } from "../internal/cx.ts";
import { nextClaimable } from "../internal/nextClaimable.ts";
import { placed } from "../internal/placed.ts";
import { stamp } from "../internal/stamp.ts";

/**
 * A `<tag>` element filled by `fill` (base elements, k.ui). While resuming it is the next server element
 * instead, in document order: `fill` runs with that element's child elements and comments as the claim region, so the
 * elements it creates claim them in order and an op claims its server region and anchor, and a server child element
 * left unclaimed is a mismatch (E1253). Not resuming, a child `fill` places that was made before the call is
 * recorded (`made`).
 */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  fill: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  const claim = cx.claim;
  if (claim === null) {
    const el = document.createElement(tag);
    const start = stamp(el);
    fill(el);
    placed(start, el.childNodes);
    return el;
  }
  const el = claimNext(claim, tag);
  if (!isTag(el, tag)) throw new Mismatch(`<${el.localName}> where the element is <${tag}>`);
  const region = { nodes: [...el.childNodes].filter((n) => n.nodeType !== 3), pos: 0 };
  cx.claim = { island: null, region, session: claim.session };
  try {
    fill(el);
  } finally {
    cx.claim = claim;
  }
  if (nextClaimable(region) !== null) throw new Mismatch(`<${tag}> has an extra child element`);
  return el;
}
