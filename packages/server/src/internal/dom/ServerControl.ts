import { ServerElement } from "./ServerElement.ts";

/**
 * A server form control (`button`, `fieldset`, `input`, `select`, `textarea`; `HTML*Element` in the DOM): `name`,
 * `value` and `disabled` reflect their attributes as in a browser, so a `prop` binding of them serializes.
 */
export class ServerControl extends ServerElement {
  protected override shallowCopy(): ServerElement {
    return new ServerControl(this.ownerDocument, this.localName);
  }

  get name(): string {
    return this.getAttribute("name") ?? "";
  }

  set name(value: string) {
    this.setAttribute("name", value);
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  set disabled(on: boolean) {
    if (on) this.setAttribute("disabled", "");
    else this.removeAttribute("disabled");
  }

  get value(): string {
    return this.getAttribute("value") ?? "";
  }

  set value(value: string) {
    this.setAttribute("value", value);
  }
}
