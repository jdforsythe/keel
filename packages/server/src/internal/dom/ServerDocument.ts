import { ServerComment } from "./ServerComment.ts";
import { ServerControl } from "./ServerControl.ts";
import { ServerElement } from "./ServerElement.ts";
import { ServerFragment } from "./ServerFragment.ts";
import { ServerInput } from "./ServerInput.ts";
import { ServerNode } from "./ServerNode.ts";
import { ServerOption } from "./ServerOption.ts";
import { ServerSelect } from "./ServerSelect.ts";
import { ServerTemplate } from "./ServerTemplate.ts";
import { ServerText } from "./ServerText.ts";
import { ServerTextArea } from "./ServerTextArea.ts";

const CONTROLS = new Set(["button", "fieldset"]);

/** The server `document` (`nodeType` 9): a node factory. It holds no tree of its own, so lookups (by id or selector) find nothing; a selector outside the supported subset still throws. */
export class ServerDocument extends ServerNode {
  override nodeType = 9;

  constructor() {
    super(null);
  }

  protected override host(): ServerDocument {
    return this;
  }

  /** A new element; `template` and the form controls get their own classes, as `HTML*Element`s do in the DOM. */
  createElement(name: string): ServerElement {
    const n = name.toLowerCase();
    if (n === "template") return new ServerTemplate(this);
    if (n === "input") return new ServerInput(this, n);
    if (n === "select") return new ServerSelect(this, n);
    if (n === "textarea") return new ServerTextArea(this, n);
    if (n === "option") return new ServerOption(this, n);
    return CONTROLS.has(n) ? new ServerControl(this, n) : new ServerElement(this, name);
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

  querySelector(selector: string): ServerElement | null {
    return ServerElement.select(this, selector, true)[0] ?? null;
  }

  querySelectorAll(selector: string): ServerElement[] {
    return ServerElement.select(this, selector, false);
  }
}
