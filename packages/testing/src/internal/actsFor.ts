import type { TestEvent } from "../types/TestEvent.ts";
import { emitOn } from "./emitOn.ts";
import { eventFor } from "./eventFor.ts";
import { moveFocus } from "./moveFocus.ts";
import { pickOption } from "./pickOption.ts";
import { submitterOf } from "./submitterOf.ts";

/** The focused element when it is `el` or inside it, else `undefined`. */
const focusedIn = (el: Element): Element | undefined => {
  const active = el.ownerDocument.activeElement;
  return active !== null && (active === el || el.contains(active)) ? active : undefined;
};

/**
 * The steps `fire(id, event)` runs on `el`, each settled before the next; refusals (E1719, E1726) throw here,
 * before anything moves. `keydown` goes to the focused element when it is `el` or inside it; otherwise focus moves to
 * `el` first (E1719 when it cannot take focus), then the key is dispatched there. `change` with `value` is a
 * select pick (`pickOption`); `submit` on a submit button goes to its form. The rest are dispatched at `el`.
 */
export function actsFor(el: Element, id: string, event: TestEvent): readonly (() => void)[] {
  switch (event.type) {
    case "emit":
      return [emitOn(el, id, event.detail)];
    case "focus":
    case "blur":
      return [moveFocus(el, event.type)];
    case "keydown": {
      const press = (): void => {
        (focusedIn(el) ?? el).dispatchEvent(eventFor(el, event));
      };
      return focusedIn(el) === undefined ? [moveFocus(el, "keydown"), press] : [press];
    }
    case "change":
      if (event.value !== undefined) return [pickOption(el, event.value)];
      return [() => void el.dispatchEvent(eventFor(el, event))];
    case "submit": {
      // A browser sends `submit` to the form; a submit button names its form's submit with itself as submitter.
      const target = submitterOf(el)?.form ?? el;
      return [() => void target.dispatchEvent(eventFor(el, event))];
    }
    default:
      return [() => void el.dispatchEvent(eventFor(el, event))];
  }
}
