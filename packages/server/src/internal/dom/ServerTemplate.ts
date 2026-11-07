import type { ServerDocument } from "./ServerDocument.ts";
import { ServerElement } from "./ServerElement.ts";
import { ServerFragment } from "./ServerFragment.ts";
import type { ServerNode } from "./ServerNode.ts";
import { cloneChildren } from "./cloneChildren.ts";
import { parseHtml } from "./parseHtml.ts";
import { serializeNode } from "./serializeNode.ts";

/** A server `<template>`: its markup lives in `content`, a fragment, not in its children. */
export class ServerTemplate extends ServerElement {
  readonly content: ServerFragment;

  constructor(doc: ServerDocument | null) {
    super(doc, "template");
    this.content = new ServerFragment(doc);
  }

  override contentNodes(): ServerNode[] {
    return this.content.childNodes;
  }

  override get innerHTML(): string {
    return serializeNode(this, "inner");
  }

  override set innerHTML(html: string) {
    this.content.textContent = null;
    parseHtml(this.host(), html, this.content);
  }

  protected override shallowCopy(): ServerTemplate {
    return new ServerTemplate(this.ownerDocument);
  }

  override cloneNode(deep?: boolean): ServerTemplate {
    const copy = new ServerTemplate(this.ownerDocument);
    for (const [name, value] of this.attributeEntries()) copy.setAttribute(name, value);
    if (deep === true) cloneChildren(this.content, copy.content);
    return copy;
  }
}
