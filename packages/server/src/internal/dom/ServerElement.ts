import type { ServerDocument } from "./ServerDocument.ts";
import { ServerNode } from "./ServerNode.ts";
import { assertName } from "./assertName.ts";
import { cloneChildren } from "./cloneChildren.ts";
import { compileSelector } from "./compileSelector.ts";
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
    return this.childNodes.flatMap((c) => (c instanceof ServerElement ? [c] : []));
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

  getElementById(id: string): ServerElement | null {
    for (const c of this.children) {
      if (c.getAttribute("id") === id) return c;
      const inner = c.getElementById(id);
      if (inner !== null) return inner;
    }
    return null;
  }

  /**
   * Descendant elements of `root` matching `selector` (`compileSelector` subset; others throw), in document order;
   * a `<template>`'s content is not searched, as in the DOM. Stops at the first match when `first`.
   */
  static select(root: ServerNode, selector: string, first: boolean): ServerElement[] {
    const test = compileSelector(selector);
    const out: ServerElement[] = [];
    const walk = (n: ServerNode): boolean =>
      n.childNodes.some((c) => (c instanceof ServerElement && test(c) && out.push(c) > 0 && first) || walk(c));
    walk(root);
    return out;
  }

  querySelector(selector: string): ServerElement | null {
    return ServerElement.select(this, selector, true)[0] ?? null;
  }

  querySelectorAll(selector: string): ServerElement[] {
    return ServerElement.select(this, selector, false);
  }

  matches(selector: string): boolean {
    return compileSelector(selector)(this);
  }

  closest(selector: string): ServerElement | null {
    const test = compileSelector(selector);
    for (let n: ServerNode | null = this; n instanceof ServerElement; n = n.parentNode) if (test(n)) return n;
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

  /** A copy with the attributes (children too when `deep`); every subclass's `shallowCopy` keeps its class. */
  override cloneNode(deep?: boolean): ServerElement {
    const copy = this.shallowCopy();
    for (const [name, value] of this.attrs) copy.setAttribute(name, value);
    if (deep === true) cloneChildren(this, copy);
    return copy;
  }

  /** A new element of this one's class and name, plus any state the DOM's cloning steps copy (no attributes). */
  protected shallowCopy(): ServerElement {
    return new ServerElement(this.ownerDocument, this.localName);
  }
}
