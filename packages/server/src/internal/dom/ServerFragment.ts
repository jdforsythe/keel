import { ServerNode } from "./ServerNode.ts";
import { cloneChildren } from "./cloneChildren.ts";

/** A server document fragment (`nodeType` 11). Inserting one moves its children. */
export class ServerFragment extends ServerNode {
  override nodeType = 11;

  get children(): ServerNode[] {
    return this.childNodes.filter((c) => c.nodeType === 1);
  }

  get firstElementChild(): ServerNode | null {
    return this.children[0] ?? null;
  }

  override cloneNode(deep?: boolean): ServerFragment {
    const copy = new ServerFragment(this.ownerDocument);
    if (deep === true) cloneChildren(this, copy);
    return copy;
  }
}
