import { ServerControl } from "./ServerControl.ts";
import type { ServerElement } from "./ServerElement.ts";
import { ServerOption } from "./ServerOption.ts";

/**
 * A server `<select>` (`HTMLSelectElement`): `value` is the value of its selected option (the last one marked
 * selected; with none, the first enabled option of a single select), else `""`; writing it selects the first option
 * with that value and deselects the rest, never changing the markup (as in a browser).
 */
export class ServerSelect extends ServerControl {
  protected override shallowCopy(): ServerElement {
    return new ServerSelect(this.ownerDocument, "select");
  }

  get type(): string {
    return this.hasAttribute("multiple") ? "select-multiple" : "select-one";
  }

  get options(): ServerOption[] {
    return this.querySelectorAll("option").filter((o): o is ServerOption => o instanceof ServerOption);
  }

  override get value(): string {
    const all = this.options;
    const picked = all.filter((o) => o.selected);
    const one = this.type === "select-one";
    return ((one ? picked.at(-1) : picked[0]) ?? (one ? all.find((o) => !o.disabled) : undefined))?.value ?? "";
  }

  override set value(value: string) {
    let found = false;
    for (const o of this.options) {
      o.selected = !found && o.value === String(value);
      found ||= o.selected;
    }
  }
}
