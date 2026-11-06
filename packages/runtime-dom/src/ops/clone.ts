import type { Claim } from "../internal/Claim.ts";
import { Mismatch } from "../internal/Mismatch.ts";
import { cx } from "../internal/cx.ts";
import { nextClaimable } from "../internal/nextClaimable.ts";
import { sameShape } from "../internal/sameShape.ts";

const claimFor = (claim: Claim, tpl: Element): Element => {
  let el: Element | null;
  if (claim.island !== null) {
    el = claim.island;
    claim.island = null;
  } else if (claim.region !== null) {
    const next = nextClaimable(claim.region);
    if (next === "text") throw new Mismatch(`text where the template has <${tpl.localName}>`);
    el = next;
  } else throw new Mismatch(`<${tpl.localName}> is not at a resumable position`);
  if (el === null) throw new Mismatch(`missing <${tpl.localName}> in server HTML`);
  const d = sameShape(tpl, el);
  if (d !== null) throw new Mismatch(d);
  return el;
};

/** A fresh copy of the template's root element; while resuming, the matching server element instead. */
export function clone(t: HTMLTemplateElement): Element {
  const tpl = t.content.firstElementChild;
  if (tpl === null) throw new Error("k.runtime: clone() of an empty template");
  let el: Element;
  if (cx.claim !== null) el = claimFor(cx.claim, tpl);
  else {
    const copy = document.importNode(tpl, true);
    if (!(copy instanceof Element)) throw new Error("k.runtime: clone() produced a non-element");
    el = copy;
  }
  cx.nodes.push(el);
  return el;
}
