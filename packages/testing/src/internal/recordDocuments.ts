import type { DocumentNavigation } from "../types/DocumentNavigation.ts";

/** `url` as the page wrote it: path, search and hash on the page's own origin, else the absolute URL. */
const written = (url: URL): string =>
  url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;

/**
 * Record, instead of make, the document navigations the browser would start under `root` (k.mount Testing): a click
 * in an `a[href]` (a `Link`) that no handler prevented is a GET; a `submit` no handler prevented is a POST (a `Form`
 * always posts) of the form's controls and submitter, urlencoded (a file is its name). Each is pushed to `into` and
 * its default prevented, so the page stays; `made`, when given, then receives it to make it. Listens on the window,
 * after every handler of the page; returns the function that stops.
 */
export function recordDocuments(
  root: Element,
  into: DocumentNavigation[],
  made?: (nav: DocumentNavigation) => void,
): () => void {
  const push = (nav: DocumentNavigation): void => {
    into.push(nav);
    made?.(nav);
  };
  const on = (e: Event): void => {
    const t = e.target instanceof Element && !e.defaultPrevented && root.contains(e.target) ? e.target : null;
    const a = e.type === "click" ? t?.closest("a[href]") : null;
    if (a instanceof HTMLAnchorElement) {
      e.preventDefault();
      push({ method: "GET", url: written(new URL(a.href, document.baseURI)), body: null });
    }
    if (!(t instanceof HTMLFormElement) || e.type !== "submit") return;
    const by = e instanceof SubmitEvent ? e.submitter : null;
    const body = new URLSearchParams();
    const data = new FormData(t, by instanceof HTMLButtonElement || by instanceof HTMLInputElement ? by : null);
    for (const [k, v] of data) body.append(k, typeof v === "string" ? v : v.name);
    e.preventDefault();
    push({ method: "POST", url: written(new URL(t.action, document.baseURI)), body: body.toString() });
  };
  addEventListener("click", on);
  addEventListener("submit", on);
  return () => {
    removeEventListener("click", on);
    removeEventListener("submit", on);
  };
}
