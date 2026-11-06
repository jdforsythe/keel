import { splitUrl } from "./splitUrl.ts";

/**
 * After a navigation initiated by `navigate` (push or replace): focus `main` (given `tabindex="-1"`) inside
 * `root` and scroll to the hash target or the top. Revalidation never calls this.
 */
export function afterNavigate(root: ParentNode | null, url: string): void {
  if (typeof window === "undefined") return;
  const main = root?.querySelector("main") ?? null;
  if (main !== null) {
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
  }
  const { hash } = splitUrl(url);
  const target = hash === "" ? null : document.getElementById(hash);
  if (target !== null) target.scrollIntoView();
  else window.scrollTo(0, 0);
}
