import { splitUrl } from "./splitUrl.ts";

/** `url` with its `next` search key removed (rfc:0051: a redirect route's own `next` that may not be carried). */
export function withoutNext(url: string): string {
  const { path, query, hash } = splitUrl(url);
  const q = new URLSearchParams(query);
  q.delete("next");
  const rest = q.toString();
  return `${path}${rest === "" ? "" : `?${rest}`}${hash === "" ? "" : `#${hash}`}`;
}
