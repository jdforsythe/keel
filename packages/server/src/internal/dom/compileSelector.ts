import type { ServerElement } from "./ServerElement.ts";

// CSS escape (`\` + 1-6 hex digits and one optional space, or `\` + any other character but a newline).
const ESC = String.raw`\\(?:[0-9a-fA-F]{1,6}[ \t\n\r\f]?|[^\n\r\f0-9a-fA-F])`;
// CSS ident: `--` or an optional `-` then a letter, `_`, non-ASCII or escape; then name characters.
const IDENT = String.raw`(?:--|-?(?:[A-Za-z_\u0080-\uffff]|${ESC}))(?:[\w\u0080-\uffff-]|${ESC})*`;
const STR = (q: string): string => String.raw`${q}((?:[^${q}\\\n\r\f]|\\[\s\S])*)${q}`;
// One token: a list comma, `*`, a type, `#id`, `.class`, or `[name]` / `[name=value]` (value quoted or an ident).
const TOKEN = new RegExp(
  String.raw`[ \t\n\r\f]*,[ \t\n\r\f]*|(\*)|(${IDENT})|#(${IDENT})|\.(${IDENT})|\[[ \t\n\r\f]*(${IDENT})[ \t\n\r\f]*(?:=[ \t\n\r\f]*(?:${STR('"')}|${STR("'")}|(${IDENT}))[ \t\n\r\f]*)?\]`,
  "y",
);

const decode = (s: string): string =>
  s.replace(/\\([0-9a-fA-F]{1,6}[ \t\n\r\f]?|[\s\S])/g, (_, e: string) => {
    if (/^[\n\r\f]/.test(e)) return "";
    if (!/^[0-9a-fA-F]/.test(e)) return e;
    const c = Number.parseInt(e, 16);
    return c === 0 || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff) ? "�" : String.fromCodePoint(c);
  });

const classes = (el: ServerElement): string[] => (el.getAttribute("class") ?? "").split(/[ \t\n\r\f]+/);

/**
 * Compile `selector` into a test over server elements (k.server node adapter). The subset is what compiled
 * templates and `@keel/runtime-dom` ask for: compound selectors of a type or `*`, `#id`, `.class`, `[name]` and
 * `[name=value]` (value quoted or an ident; CSS escapes decoded), and comma lists of them. Type and attribute
 * names match ASCII case-insensitively, values exactly. Anything else (combinators, pseudo-classes, other
 * attribute operators) throws a `SyntaxError` naming the selector, so a lookup never silently finds nothing.
 */
export function compileSelector(selector: string): (el: ServerElement) => boolean {
  const fail = (): never => {
    throw Object.assign(
      new Error(
        `k.server: unsupported selector ${JSON.stringify(selector).slice(0, 80)} (the server DOM supports type, *, #id, .class, [name], [name=value] and "," lists)`,
      ),
      { name: "SyntaxError" },
    );
  };
  const src = selector.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, "");
  const list: ((el: ServerElement) => boolean)[][] = [[]];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < src.length) {
    const m = TOKEN.exec(src) ?? fail();
    const parts = list[list.length - 1] ?? fail();
    const [, star, type, id, cls, name, dq, sq, bare] = m;
    if ((star !== undefined || type !== undefined) && parts.length > 0) fail();
    if (star !== undefined) parts.push(() => true);
    else if (type !== undefined) {
      const t = decode(type).toLowerCase();
      parts.push((el) => el.localName === t);
    } else if (id !== undefined) {
      const v = decode(id);
      parts.push((el) => el.getAttribute("id") === v);
    } else if (cls !== undefined) {
      const v = decode(cls);
      parts.push((el) => classes(el).includes(v));
    } else if (name !== undefined) {
      const n = decode(name);
      const raw = dq ?? sq ?? bare;
      const v = raw === undefined ? undefined : decode(raw);
      parts.push((el) => (v === undefined ? el.hasAttribute(n) : el.getAttribute(n) === v));
    } else {
      if (parts.length === 0) fail();
      list.push([]);
    }
  }
  if (list.some((parts) => parts.length === 0)) fail();
  return (el) => list.some((parts) => parts.every((test) => test(el)));
}
