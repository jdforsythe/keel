import { safeUrl } from "@keel/runtime-dom/url";
import { applyStyle } from "../internal/applyStyle.ts";
import type { StyleProps } from "../types/StyleProps.ts";

type Alt = { readonly alt: string; readonly decorative?: never } | { readonly decorative: true; readonly alt?: never };

/**
 * An image with `alt` text, or `decorative` (`alt=""`, `role="presentation"`); one is required (E1802). `src` is an asset
 * URL string, not an `Href` (k.compiler URL policy, RFC 0041); an unsafe scheme renders `about:blank`.
 */
export function Image(props: StyleProps & { readonly src?: string; readonly id?: string } & Alt): Node {
  const el = document.createElement("img");
  if (props.src !== undefined) el.setAttribute("src", safeUrl("src", props.src));
  if (props.id !== undefined) el.setAttribute("id", props.id);
  if (props.decorative === true) {
    el.setAttribute("alt", "");
    el.setAttribute("role", "presentation");
  } else el.setAttribute("alt", props.alt ?? "");
  applyStyle(el, props);
  return el;
}
