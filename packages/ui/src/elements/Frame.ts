import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { attrOf } from "../internal/attrOf.ts";
import { isGetter } from "../internal/isGetter.ts";
import { make } from "../internal/make.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/**
 * An `<iframe>` of a third-party page (k.origins Frame), which the policy admits only from an origin the deployable
 * declares under `frame`. `title`, required (E1802), is its accessible name. `src` that is not an absolute `http` or
 * `https` URL renders `about:blank`. `allow` is written joined by `; `. Fixed: `loading="lazy"`,
 * `referrerpolicy="strict-origin"` and a sandbox with no top navigation, forms or downloads.
 */
export function Frame(
  props: StyleProps & {
    readonly src: string;
    readonly title: string;
    readonly allow?: readonly ("autoplay" | "encrypted-media" | "fullscreen" | "picture-in-picture")[];
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
  },
): Node {
  return make("iframe", (el) => {
    attrOf(el, "src", isGetter(props, "src"), () => (/^https?:\/\//i.test(props.src) ? props.src : "about:blank"));
    attrOf(el, "title", isGetter(props, "title"), () => props.title);
    attrOf(el, "allow", isGetter(props, "allow"), () => props.allow?.join("; "));
    el.setAttribute("loading", "lazy");
    el.setAttribute("referrerpolicy", "strict-origin");
    el.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-presentation");
    applyIdLang(el, props);
    applyStyle(el, props);
  });
}
