import type { TestEvent } from "../types/TestEvent.ts";
import { submitterOf } from "./submitterOf.ts";

/** The DOM event `fire` dispatches for `event`; `input` writes `value` to the element first; `mod` is `ctrlKey`; a `submit` carries the submit button `el` as its submitter. */
export function eventFor(el: Element, event: Exclude<TestEvent, { type: "focus" | "blur" | "emit" }>): Event {
  switch (event.type) {
    case "click":
      return new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    case "input":
      Reflect.set(el, "value", event.value);
      return new Event("input", { bubbles: true });
    case "change":
      return new Event("change", { bubbles: true });
    case "keydown":
      return new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: event.key,
        shiftKey: event.shift === true,
        altKey: event.alt === true,
        ctrlKey: event.mod === true,
      });
    case "submit":
      return new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: submitterOf(el) });
  }
}
