import type { ServerDocument } from "./ServerDocument.ts";
import { ServerNode } from "./ServerNode.ts";
import { assertName } from "./assertName.ts";
import { cloneChildren } from "./cloneChildren.ts";
import { parseHtml } from "./parseHtml.ts";
import { serializeNode } from "./serializeNode.ts";

/**
 * A server element (`nodeType` 1): attributes, children, `innerHTML`/`outerHTML`; events are accepted and never fire.
 * An invalid element or attribute name throws `InvalidCharacterError` (`assertName`), as in a browser.
 */
export class ServerElement extends ServerNode {
  override nodeType = 1;
  readonly localName: string;
  private readonly attrs = new Map<string, string>();

  constructor(doc: ServerDocument | null, localName: string) {
    super(doc);
    this.localName = assertName("element", localName).toLowerCase();
  }

  get tagName(): string {
    return this.localName.toUpperCase();
  }

  get id(): string {
    return this.getAttribute("id") ?? "";
  }

  set id(value: string) {
    this.setAttribute("id", value);
  }

  get className(): string {
    return this.getAttribute("class") ?? "";
  }

  set className(value: string) {
    this.setAttribute("class", value);
  }

  get children(): ServerElement[] {
    return this.childNodes.filter((c): c is ServerElement => c instanceof ServerElement);
  }

  get firstElementChild(): ServerElement | null {
    return this.children[0] ?? null;
  }

  attributeEntries(): IterableIterator<[string, string]> {
    return this.attrs.entries();
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(assertName("attribute", name).toLowerCase(), String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name.toLowerCase()) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attrs.has(name.toLowerCase());
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name.toLowerCase());
  }

  addEventListener(_type: string, _listener: unknown, _options?: unknown): void {}

  removeEventListener(_type: string, _listener: unknown, _options?: unknown): void {}

  getElementById(id: string): ServerElement | null {
    for (const c of this.children) {
      if (c.getAttribute("id") === id) return c;
      const inner = c.getElementById(id);
      if (inner !== null) return inner;
    }
    return null;
  }

  /** The nodes `innerHTML` serializes: the children (a template's `content` instead). */
  contentNodes(): ServerNode[] {
    return this.childNodes;
  }

  get innerHTML(): string {
    return serializeNode(this, "inner");
  }

  set innerHTML(html: string) {
    this.textContent = null;
    parseHtml(this.host(), html, this);
  }

  get outerHTML(): string {
    return serializeNode(this);
  }

  override cloneNode(deep?: boolean): ServerElement {
    const copy = this.shallowCopy();
    for (const [name, value] of this.attrs) copy.setAttribute(name, value);
    if (deep === true) cloneChildren(this, copy);
    return copy;
  }

  protected shallowCopy(): ServerElement {
    return new ServerElement(this.ownerDocument, this.localName);
  }
}
