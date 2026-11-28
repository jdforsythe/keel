const TAG = /<script\b([^>]*)>/gi;
const SRC = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const TYPE = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const LATER = /(?:^|\s)(?:async|defer)(?=\s|=|\/|$)/i;
const CLASSIC = /^(?:(?:text|application)\/(?:x-)?(?:java|ecma)script)?$/i;

const attrValue = (m: RegExpExecArray | null): string | undefined => (m === null ? undefined : (m[1] ?? m[2] ?? m[3]));

/**
 * The URLs of the scripts the parser of `html` (a document at `base`) waits for: each external classic script with
 * neither `async` nor `defer`. A held page (k.e2e-page `hold`) lets these run, since the document is never parsed
 * without them; a module script or a later classic one waits for `resume()`.
 */
export function parserScripts(html: string, base: string): ReadonlySet<string> {
  const urls = new Set<string>();
  for (const tag of html.matchAll(TAG)) {
    const attrs = tag[1] ?? "";
    const src = attrValue(SRC.exec(attrs));
    if (src === undefined || src.trim() === "" || LATER.test(attrs)) continue;
    if (!CLASSIC.test((attrValue(TYPE.exec(attrs)) ?? "").trim())) continue;
    try {
      urls.add(new URL(src.trim(), base).href);
    } catch {
      // A `src` that is no URL fetches nothing.
    }
  }
  return urls;
}
