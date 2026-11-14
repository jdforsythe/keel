import { quiet } from "@keel/ctx/internal";
import { splitUrl } from "./splitUrl.ts";

/**
 * After a navigation initiated by `navigate` (push or replace), inside `root` (k.head Client): to another route,
 * focus the page's first `h1`, else `main` (either given `tabindex="-1"`); within one route (`kept`, the element
 * focused before), focus stays; when the navigation removed it, it goes to the element with its id, else (when no
 * widget took it) the page's first `role="status"` region, else `main` (given `tabindex="-1"`). Then scroll to the hash
 * target, else to the top unless the path is `from`'s (a search-only navigation keeps scroll). Revalidation never
 * calls this.
 */
export function afterNavigate(root: ParentNode | null, url: string, kept?: Element | null, from?: string): void {
  if (typeof window === "undefined") return;
  const main = root?.querySelector("main") ?? null;
  // Kernel focus, not user input: its focus/blur are not reported to ctx observers.
  const move = (to: Element | null | undefined, mark: boolean): void => {
    if (!(to instanceof HTMLElement)) return;
    if (mark && !to.hasAttribute("tabindex")) to.setAttribute("tabindex", "-1");
    quiet(() => to.focus({ preventScroll: true }));
  };
  if (kept === undefined) move((main ?? root)?.querySelector("h1") ?? main, true);
  else if (kept?.isConnected === false) {
    const named = kept.id === "" ? null : document.getElementById(kept.id);
    if (named !== null) move(named, false);
    // Removed with no element of its id: once a widget's own handoff had its turn, the page's first `role="status"`
    // region, else `main`.
    else
      queueMicrotask(() => {
        const at = document.activeElement;
        if (at === null || at === document.body) move((main ?? root)?.querySelector('[role="status"]') ?? main, true);
      });
  }
  const { path, hash } = splitUrl(url);
  const target = hash === "" ? null : document.getElementById(hash);
  if (target !== null) target.scrollIntoView();
  else if (from === undefined || splitUrl(from).path !== path) window.scrollTo(0, 0);
}
