import { escapeHtml } from "../escapeHtml.ts";
import { ServerComment } from "./ServerComment.ts";
import { ServerElement } from "./ServerElement.ts";
import type { ServerNode } from "./ServerNode.ts";
import { ServerText } from "./ServerText.ts";
import { VOID_TAGS } from "./VOID_TAGS.ts";

const RAW_TEXT = new Set(["script", "style"]);

const openTag = (el: ServerElement): string => {
  let out = `<${el.localName}`;
  for (const [name, value] of el.attributeEntries()) out += ` ${name}="${escapeHtml(value)}"`;
  return `${out}>`;
};

/** Serialize a server node (and its subtree) to HTML like `outerHTML`; a fragment serializes its children. */
export function serializeNode(node: ServerNode): string {
  if (node instanceof ServerComment) return `<!--${node.data}-->`;
  if (node instanceof ServerText) {
    const parent = node.parentNode;
    return parent instanceof ServerElement && RAW_TEXT.has(parent.localName) ? node.data : escapeHtml(node.data);
  }
  if (node instanceof ServerElement) {
    if (VOID_TAGS.has(node.localName)) return openTag(node);
    return `${openTag(node)}${node.innerHTML}</${node.localName}>`;
  }
  return node.childNodes.map(serializeNode).join("");
}
