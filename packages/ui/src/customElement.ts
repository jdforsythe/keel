import { hostCode } from "./hostCode.ts";
import type { HostCode } from "./types/HostCode.ts";

/**
 * Host element code for a custom element (k.host-code customElement): `mount` creates `tag` as the node's only child,
 * `set(el, value)` runs at mount and on each update, and `dispose` removes the child. Each `events` key is a DOM event
 * type the child dispatches, listened for on the child with `out.signal`; its entry maps the event to what `emit`
 * carries.
 */
export function customElement<I, E = never>(
  tag: `${string}-${string}`,
  def: {
    readonly set: (el: HTMLElement, value: I) => void;
    readonly events?: { readonly [type: string]: (ev: Event) => E };
  },
): HostCode<I, E> {
  return hostCode<I, E, HTMLElement>({
    mount(node, value, out) {
      const el = node.ownerDocument.createElement(tag);
      for (const [type, map] of Object.entries(def.events ?? {}))
        el.addEventListener(type, (ev) => out.emit(map(ev)), { signal: out.signal });
      def.set(el, value);
      node.replaceChildren(el);
      return el;
    },
    update(el, value) {
      def.set(el, value);
    },
    dispose(el) {
      el.remove();
    },
  });
}
