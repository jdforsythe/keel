import type { ServerDocument } from "./ServerDocument.ts";
import type { ServerNode } from "./ServerNode.ts";
import { VOID_TAGS } from "./VOID_TAGS.ts";
import { unescapeHtml } from "./unescapeHtml.ts";

const TOKEN = /<!--([\s\S]*?)-->|<\/([a-zA-Z][^\s>]*)\s*>|<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTR = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const RAW_TEXT = new Set(["script", "style"]);

/**
 * Parse `html` (compiler-hoisted templates, `innerHTML`) into children of `into`: elements with attributes,
 * text with character references decoded, comments, void elements, and raw `script`/`style` text. Not a
 * spec parser: it does no error recovery beyond ignoring stray closing tags.
 */
export function parseHtml(doc: ServerDocument, html: string, into: ServerNode): void {
  const stack: ServerNode[] = [into];
  const top = (): ServerNode => stack[stack.length - 1] ?? into;
  const text = (s: string): void => {
    if (s !== "") top().appendChild(doc.createTextNode(unescapeHtml(s)));
  };
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(html); m !== null; m = TOKEN.exec(html)) {
    text(html.slice(last, m.index));
    last = TOKEN.lastIndex;
    if (m[1] !== undefined) {
      top().appendChild(doc.createComment(m[1]));
    } else if (m[2] !== undefined) {
      const name = m[2].toLowerCase();
      const at = stack.map((n) => (n.nodeType === 1 ? Reflect.get(n, "localName") : null)).lastIndexOf(name);
      if (at > 0) stack.length = at;
    } else if (m[3] !== undefined) {
      const name = m[3].toLowerCase();
      const el = doc.createElement(name);
      const attrs = m[4] ?? "";
      ATTR.lastIndex = 0;
      for (let a = ATTR.exec(attrs); a !== null; a = ATTR.exec(attrs)) {
        el.setAttribute(a[1] ?? "", unescapeHtml(a[2] ?? a[3] ?? a[4] ?? ""));
      }
      top().appendChild(el);
      if (RAW_TEXT.has(name)) {
        const close = html.toLowerCase().indexOf(`</${name}`, last);
        const end = close < 0 ? html.length : close;
        if (end > last) el.appendChild(doc.createTextNode(html.slice(last, end)));
        const gt = html.indexOf(">", end);
        last = gt < 0 ? html.length : gt + 1;
        TOKEN.lastIndex = last;
      } else if (!VOID_TAGS.has(name) && !attrs.trimEnd().endsWith("/")) {
        stack.push(el);
      }
    }
  }
  text(html.slice(last));
}
