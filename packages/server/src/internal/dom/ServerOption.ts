import { ServerElement } from "./ServerElement.ts";

/**
 * A server `<option>` (`HTMLOptionElement`): `value` is its `value` attribute, else its text with whitespace
 * collapsed; `selected` is its current selectedness, the `selected` attribute until a write (which never changes the
 * markup, as in a browser).
 */
export class ServerOption extends ServerElement {
  private current: boolean | undefined;

  get value(): string {
    return this.getAttribute("value") ?? (this.textContent ?? "").replace(/[ \t\n\r\f]+/g, " ").trim();
  }

  set value(value: string) {
    this.setAttribute("value", value);
  }

  get selected(): boolean {
    return this.current ?? this.hasAttribute("selected");
  }

  set selected(on: boolean) {
    this.current = Boolean(on);
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  /** An option has no cloning steps in the DOM: a clone's selectedness starts from its `selected` attribute. */
  protected override shallowCopy(): ServerElement {
    return new ServerOption(this.ownerDocument, "option");
  }
}
