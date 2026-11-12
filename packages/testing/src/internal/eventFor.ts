import type { TestEvent } from "../types/TestEvent.ts";

/** The DOM event `fire` dispatches for `event`; `input` writes `value` to the element first. */
export function eventFor(el: Element, event: Exclude<TestEvent, { type: "focus" | "blur" }>): Event {
  switch (event.type) {
    case "click":
      return new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    case "input":
      Reflect.set(el, "value", event.value);
      return new Event("input", { bubbles: true });
    case "change":
      return new Event("change", { bubbles: true });
    case "keydown":
      return new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: event.key });
    case "submit":
      return new Event("submit", { bubbles: true, cancelable: true });
  }
}
