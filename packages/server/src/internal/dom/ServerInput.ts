import { ServerControl } from "./ServerControl.ts";
import type { ServerElement } from "./ServerElement.ts";

const TYPES = new Set(
  "hidden text search tel url email password date month week time datetime-local number range color checkbox radio file submit image reset button".split(
    " ",
  ),
);
// Types whose `value` is the `value` attribute (HTML value modes "default" and "default/on"); "file" reads "".
const ATTRIBUTE_VALUE = new Set(["hidden", "submit", "image", "reset", "button", "checkbox", "radio"]);

/**
 * A server `<input>` (`HTMLInputElement`). `type` reflects its attribute (unknown: `text`). `value` and `checked`
 * are the control's current state, as in a browser: they start from the `value` and `checked` attributes and a write
 * never changes the markup, except `value` of a checkbox, radio, hidden or button type, which is the attribute
 * (`on` by default for checkbox and radio). No value sanitization, no radio-group exclusivity.
 */
export class ServerInput extends ServerControl {
  private current: { value?: string; checked?: boolean } = {};

  get type(): string {
    const t = this.getAttribute("type")?.toLowerCase() ?? "";
    return TYPES.has(t) ? t : "text";
  }

  set type(value: string) {
    this.setAttribute("type", value);
  }

  override get value(): string {
    const t = this.type;
    if (t === "file") return "";
    if (!ATTRIBUTE_VALUE.has(t)) return this.current.value ?? this.getAttribute("value") ?? "";
    return this.getAttribute("value") ?? (t === "checkbox" || t === "radio" ? "on" : "");
  }

  override set value(value: string) {
    const t = this.type;
    if (t === "file" && value !== "")
      throw Object.assign(new Error("k.server: a file input's value can only be set to ''"), {
        name: "InvalidStateError",
      });
    if (ATTRIBUTE_VALUE.has(t)) this.setAttribute("value", value);
    else this.current.value = value ?? "";
  }

  get checked(): boolean {
    return this.current.checked ?? this.hasAttribute("checked");
  }

  set checked(on: boolean) {
    this.current.checked = Boolean(on);
  }

  /** The DOM's cloning steps copy an input's value and checkedness. */
  protected override shallowCopy(): ServerElement {
    const copy = new ServerInput(this.ownerDocument, "input");
    copy.current = { ...this.current };
    return copy;
  }
}
