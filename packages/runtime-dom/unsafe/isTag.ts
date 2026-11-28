import { unsafe } from "./unsafe.ts";

/** True when `el` is a `<tag>` element (HTML namespace names are lower case). */
export const isTag: <K extends keyof HTMLElementTagNameMap>(el: Element, tag: K) => el is HTMLElementTagNameMap[K] =
  unsafe(
    "an element's localName names its HTML interface in every realm, the server's document among them, where instanceof cannot tell",
    () =>
      <K extends keyof HTMLElementTagNameMap>(el: Element, tag: K): el is HTMLElementTagNameMap[K] =>
        el.localName === tag,
  );
