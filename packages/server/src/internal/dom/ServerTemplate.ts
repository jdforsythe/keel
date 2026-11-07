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

  override cloneNode(deep?: boolean): ServerElement {
    const copy = super.cloneNode(false);
    if (deep === true && copy instanceof ServerTemplate) cloneChildren(this.content, copy.content);
    return copy;
  }
}
