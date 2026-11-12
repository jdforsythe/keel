import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { attrOf } from "../internal/attrOf.ts";
import { isGetter } from "../internal/isGetter.ts";
import { make } from "../internal/make.ts";
import type { StyleProps } from "../types/StyleProps.ts";

type Alt = { readonly alt: string; readonly decorative?: never } | { readonly decorative: true; readonly alt?: never };

/**
 * An image with `alt` text, or `decorative` (`alt=""`, `role="presentation"`); one is required (E1802). `src` is an asset
 * URL string, not an `Href` (k.compiler URL policy, RFC 0041); an unsafe scheme renders `about:blank`.
 */
export function Image(
  props: StyleProps & {
    readonly src?: string;
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
  } & Alt,
): Node {
  return make("img", (el) => {
    attrOf(el, "src", isGetter(props, "src"), () => props.src);
    applyIdLang(el, props);
    const live = isGetter(props, "alt") || isGetter(props, "decorative");
    attrOf(el, "alt", live, () => (props.decorative === true ? "" : (props.alt ?? "")));
    attrOf(el, "role", live, () => (props.decorative === true ? "presentation" : null));
    applyStyle(el, props);
  });
}
