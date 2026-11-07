import { roleFor } from "@keel/compiler/a11y";

/** The element's role from the compiler's shared table (`roleFor`); a tag the table lacks is `generic`. */
export function roleOf(el: Element): string {
  return roleFor(el.tagName.toLowerCase(), (name) => el.getAttribute(name)) ?? "generic";
}
