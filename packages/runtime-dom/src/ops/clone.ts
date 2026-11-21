import { Mismatch } from "../internal/Mismatch.ts";
import { alignTexts } from "../internal/alignTexts.ts";
import { claimNext } from "../internal/claimNext.ts";
import { cx } from "../internal/cx.ts";
import { sameShape } from "../internal/sameShape.ts";
import { stamp } from "../internal/stamp.ts";

/** A fresh copy of the template's root element; while resuming, the matching server element instead. */
export function clone(t: HTMLTemplateElement): Element {
  const tpl = t.content.firstElementChild;
  if (tpl === null) throw new Error("k.runtime: clone() of an empty template");
  let el: Element;
  if (cx.claim !== null) {
    el = claimNext(cx.claim, tpl.localName);
    const d = sameShape(tpl, el);
    if (d !== null) throw new Mismatch(d);
    alignTexts(tpl, el, cx.claim.session.shadowed);
  } else {
    const copy = document.importNode(tpl, true);
    if (!(copy instanceof Element)) throw new Error("k.runtime: clone() produced a non-element");
    el = copy;
    stamp(el);
  }
  cx.nodes.push(el);
  return el;
}
