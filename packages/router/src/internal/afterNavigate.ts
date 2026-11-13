import { quiet } from "@keel/ctx/internal";
import { splitUrl } from "./splitUrl.ts";

/**
 * After a navigation initiated by `navigate` (push or replace), inside `root` (k.head Client): to another route,
 * focus the page's first `h1`, else `main` (either given `tabindex="-1"`); within one route (`kept`, the element
 * focused before), focus stays, on the element with its id when the page was rebuilt. Then scroll to the hash
 * target or the top. Revalidation never calls this.
 */
export function afterNavigate(root: ParentNode | null, url: string, kept?: Element | null): void {
  if (typeof window === "undefined") return;
  const main = root?.querySelector("main") ?? null;
  const to =
    kept === undefined
      ? ((main ?? root)?.querySelector("h1") ?? main)
      : kept?.isConnected === false && kept.id !== ""
        ? document.getElementById(kept.id)
        : null;
  if (to instanceof HTMLElement) {
    if (kept === undefined && !to.hasAttribute("tabindex")) to.setAttribute("tabindex", "-1");
    // Kernel focus, not user input: its focus/blur are not reported to ctx observers (rfc:0070).
    quiet(() => to.focus({ preventScroll: true }));
  }
  const { hash } = splitUrl(url);
  const target = hash === "" ? null : document.getElementById(hash);
  if (target !== null) target.scrollIntoView();
  else window.scrollTo(0, 0);
}
