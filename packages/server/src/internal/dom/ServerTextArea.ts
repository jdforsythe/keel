import { ServerControl } from "./ServerControl.ts";
import type { ServerElement } from "./ServerElement.ts";

/**
 * A server `<textarea>` (`HTMLTextAreaElement`): `value` is its current text, the element's text content until a
 * write, which never changes the markup (as in a browser).
 */
export class ServerTextArea extends ServerControl {
  private current: string | undefined;

  get type(): string {
    return "textarea";
  }

  override get value(): string {
    return this.current ?? this.textContent ?? "";
  }

  override set value(value: string) {
    this.current = value ?? "";
  }

  /** The DOM's cloning steps copy a textarea's raw value. */
  protected override shallowCopy(): ServerElement {
    const copy = new ServerTextArea(this.ownerDocument, "textarea");
    copy.current = this.current;
    return copy;
  }
}
