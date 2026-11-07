import type { ServerDocument } from "./ServerDocument.ts";

/**
 * The DOM-free server `Node` (k.server): enough of the DOM tree API for kernel components and
 * `@keel/runtime-dom` ops to build a tree in plain Node and serialize it. Subclasses set `nodeType`.
 */
export class ServerNode {
  nodeType = 0;
  parentNode: ServerNode | null = null;
  childNodes: ServerNode[] = [];
  ownerDocument: ServerDocument | null;

  constructor(doc: ServerDocument | null) {
    this.ownerDocument = doc;
  }

  get firstChild(): ServerNode | null {
    return this.childNodes[0] ?? null;
  }

  get lastChild(): ServerNode | null {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get nextSibling(): ServerNode | null {
    const siblings = this.parentNode?.childNodes;
    return siblings?.[siblings.indexOf(this) + 1] ?? null;
  }

  get previousSibling(): ServerNode | null {
    const siblings = this.parentNode?.childNodes;
    const at = siblings === undefined ? -1 : siblings.indexOf(this);
    return at > 0 ? (siblings?.[at - 1] ?? null) : null;
  }

  get parentElement(): ServerNode | null {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null;
  }

  get nodeValue(): string | null {
    return null;
  }

  set nodeValue(_value: string | null) {}

  get textContent(): string | null {
    return this.childNodes.map((c) => c.textContent ?? "").join("");
  }

  set textContent(value: string | null) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    if (value !== null && value !== "") this.appendChild(this.host().createTextNode(value));
  }

  /** The document that creates this node's siblings (a document is its own host). */
  protected host(): ServerDocument {
    if (this.ownerDocument === null) throw new Error("k.server: a node without a document cannot create nodes");
    return this.ownerDocument;
  }

  appendChild<T extends ServerNode>(node: T): T {
    return this.insertBefore(node, null);
  }

  insertBefore<T extends ServerNode>(node: T, ref: ServerNode | null): T {
    if (node.nodeType === 11) {
      const moved = node.childNodes;
      node.childNodes = [];
      for (const c of moved) {
        c.parentNode = null;
        this.insertBefore(c, ref);
      }
      return node;
    }
    node.parentNode?.removeChild(node);
    const at = ref === null ? -1 : this.childNodes.indexOf(ref);
    if (at < 0) this.childNodes.push(node);
    else this.childNodes.splice(at, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild<T extends ServerNode>(node: T): T {
    const at = this.childNodes.indexOf(node);
    if (at >= 0) this.childNodes.splice(at, 1);
    node.parentNode = null;
    return node;
  }

  remove(): void {
    this.parentNode?.removeChild(this);
  }

  replaceWith(...items: (ServerNode | string)[]): void {
    const parent = this.parentNode;
    if (parent === null) return;
    for (const item of items) parent.insertBefore(this.asNode(item), this);
    parent.removeChild(this);
  }

  append(...items: (ServerNode | string)[]): void {
    for (const item of items) this.appendChild(this.asNode(item));
  }

  prepend(...items: (ServerNode | string)[]): void {
    const first = this.firstChild;
    for (const item of items) this.insertBefore(this.asNode(item), first);
  }

  contains(node: ServerNode | null): boolean {
    for (let n = node; n !== null; n = n.parentNode) if (n === this) return true;
    return false;
  }

  cloneNode(_deep?: boolean): ServerNode {
    return new ServerNode(this.ownerDocument);
  }

  private asNode(item: ServerNode | string): ServerNode {
    return typeof item === "string" ? this.host().createTextNode(item) : item;
  }
}
