/**
 * k.head's fallback title as the router starts: the `title` a server wrote into the document's `#k-state` (the served
 * deployable's name), else the document's title (a `client` deployable's `index.html` title); `""` with no document.
 */
export function fallbackTitle(): string {
  if (typeof document === "undefined") return "";
  const text = document.getElementById("k-state")?.textContent ?? "";
  if (text === "") return document.title;
  try {
    const state: unknown = JSON.parse(text);
    const title: unknown = typeof state === "object" && state !== null ? Reflect.get(state, "title") : undefined;
    return typeof title === "string" ? title : document.title;
  } catch {
    return document.title;
  }
}
