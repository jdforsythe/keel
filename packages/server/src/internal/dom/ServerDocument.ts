import { ServerComment } from "./ServerComment.ts";
import { ServerElement } from "./ServerElement.ts";
import { ServerFragment } from "./ServerFragment.ts";
import { ServerNode } from "./ServerNode.ts";
import { ServerTemplate } from "./ServerTemplate.ts";
import { ServerText } from "./ServerText.ts";

/** The server `document` (`nodeType` 9): a node factory. It holds no tree of its own, so lookups by id find nothing. */
export class ServerDocument extends ServerNode {
  override nodeType = 9;

  constructor() {
    super(null);
  }

  protected override host(): ServerDocument {
    return this;
  }

  createElement(name: string): ServerElement {
    return name.toLowerCase() === "template" ? new ServerTemplate(this) : new ServerElement(this, name);
  }

  createElementNS(_ns: string | null, name: string): ServerElement {
    return this.createElement(name);
  }

  createTextNode(data: string): ServerText {
    return new ServerText(this, data);
  }

  createComment(data: string): ServerComment {
    return new ServerComment(this, data);
  }

  createDocumentFragment(): ServerFragment {
    return new ServerFragment(this);
  }

  importNode(node: ServerNode, deep?: boolean): ServerNode {
    return node.cloneNode(deep);
  }

  getElementById(_id: string): ServerElement | null {
    return null;
  }
}
