import { escapeHtml } from "../escapeHtml.ts";
import { ServerComment } from "./ServerComment.ts";
import { ServerElement } from "./ServerElement.ts";
import type { ServerNode } from "./ServerNode.ts";
import { ServerText } from "./ServerText.ts";
import { VOID_TAGS } from "./VOID_TAGS.ts";
import { escapeComment } from "./escapeComment.ts";
import { rawText } from "./rawText.ts";

// HTML raw text: children written unescaped, then `rawText` rules over the joined content.
const RAW = new Set(["script", "style"]);
// Every element whose content the HTML tokenizer reads as text up to `</name` (raw text and escapable raw text).
const TEXT_ONLY = new Set([
  ...RAW,
  "textarea",
  "title",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
]);
// Elements whose first newline the HTML parser drops.
const LEADING_LF = new Set(["textarea", "pre", "listing"]);
// Foreign content: a `style`/`script` under these is markup, so its text is escaped like any text.
const FOREIGN = new Set(["svg", "math"]);

const openTag = (el: ServerElement): string => {
  let out = `<${el.localName}`;
  for (const [name, value] of el.attributeEntries()) out += ` ${name}="${escapeHtml(value)}"`;
  return `${out}>`;
};

const inForeign = (node: ServerNode): boolean => {
  for (let p = node.parentNode; p !== null; p = p.parentNode) {
    if (p instanceof ServerElement && FOREIGN.has(p.localName)) return true;
  }
  return false;
};

const outer = (node: ServerNode, foreign: boolean): string => {
  if (node instanceof ServerComment) return `<!--${escapeComment(node.data)}-->`;
  if (node instanceof ServerText) {
    const parent = node.parentNode;
    return !foreign && parent instanceof ServerElement && RAW.has(parent.localName)
      ? rawText(parent.localName, node.data)
      : escapeHtml(node.data);
  }
  if (node instanceof ServerElement) {
    if (VOID_TAGS.has(node.localName)) return openTag(node);
    const html = inner(node, foreign);
    // The parser drops one newline after these start tags (backlog 0179): a leading one is written twice.
    const lf = !foreign && LEADING_LF.has(node.localName) && /^[\r\n]/.test(html) ? "\n" : "";
    return `${openTag(node)}${lf}${html}</${node.localName}>`;
  }
  return node.childNodes.map((c) => outer(c, foreign)).join("");
};

const inner = (el: ServerElement, outside: boolean): string => {
  const name = el.localName;
  const foreign = outside || FOREIGN.has(name);
  if (!TEXT_ONLY.has(name))
    return el
      .contentNodes()
      .map((c) => outer(c, foreign))
      .join("");
  // A parser never puts a comment here (HTML) and it means nothing in foreign content, while its data could end
  // the element when a browser reads the element as HTML (backlog 0140): comments inside are dropped.
  const kids = el.contentNodes().filter((c) => !(c instanceof ServerComment));
  // Adjacent text children are joined before `rawText`, so `<` + `/script>` cannot meet unescaped.
  const html =
    !foreign && RAW.has(name)
      ? rawText(name, kids.map((c) => (c instanceof ServerText ? c.data : outer(c, false))).join(""))
      : kids.map((c) => outer(c, foreign)).join("");
  const low = html.toLowerCase();
  if (low.includes(`</${name}`) || (name === "script" && low.includes("<!--"))) {
    throw new Error(`k.server: <${name}> content would end the element early`);
  }
  return html;
};

/**
 * Serialize a server node (and its subtree) to HTML like `outerHTML`, or an element's children like `innerHTML`
 * (`part: "inner"`); a fragment serializes its children. Names were checked on creation (`assertName`); comment
 * data is escaped (`escapeComment`); raw text cannot end its element: `script`/`style` content is joined, then
 * escaped or refused (`rawText`), any text-only element (`textarea`, `title`, `xmp`, ...) refuses content holding
 * its own end tag, and under `svg`/`math` (foreign content, also through `foreignObject`) `script`/`style` text is
 * escaped as `&lt;` like any text: the parser decodes it there, and as HTML raw text it stays inert.
 */
export function serializeNode(node: ServerNode, part: "outer" | "inner" = "outer"): string {
  const foreign = inForeign(node);
  return part === "inner" && node instanceof ServerElement ? inner(node, foreign) : outer(node, foreign);
}
