import { escapeHtml } from "./escapeHtml.ts";

/**
 * Serialize what a component returned (minimal SSR renderer, k.server): a string is HTML as is; a DOM
 * `Node` (the server DOM, happy-dom or a browser DOM) is serialized without touching `document` (`outerHTML` for an element); an array joins its
 * items; `null`, `undefined` and booleans render nothing; any other value renders as escaped text.
 */
export function toHtml(out: unknown): string {
  if (typeof out === "string") return out;
  if (out === null || out === undefined || typeof out === "boolean") return "";
  if (Array.isArray(out)) return out.map(toHtml).join("");
  if (typeof Node !== "undefined" && out instanceof Node) {
    if (out instanceof Element) return out.outerHTML;
    if (out.nodeType === 3) return escapeHtml(out.nodeValue ?? "");
    if (out.nodeType === 8) return `<!--${out.nodeValue ?? ""}-->`;
    return Array.from(out.childNodes, toHtml).join("");
  }
  return typeof out === "number" ? String(out) : escapeHtml(String(out));
}
