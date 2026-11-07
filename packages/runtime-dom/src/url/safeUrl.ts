import { isSafeUrl } from "./isSafeUrl.ts";

/**
 * `value` if attribute `name` may hold it (`isSafeUrl`), else `about:blank`. Used by `attr`, `prop`, the
 * compiler's static templates, and `@keel/ui` `Link`/`Image`.
 */
export function safeUrl(name: string, value: string): string {
  return isSafeUrl(name, value) ? value : "about:blank";
}
