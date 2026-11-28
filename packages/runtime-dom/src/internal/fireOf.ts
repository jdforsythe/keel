import type { FireEvent } from "@keel/ctx";

const PLAIN: Readonly<Record<string, FireEvent>> = {
  click: { type: "click" },
  change: { type: "change" },
  submit: { type: "submit" },
  focus: { type: "focus" },
  blur: { type: "blur" },
};

/**
 * The observer form of DOM event `e` on `el` (k.ctx Observers). For a `secret` field an `input` value, and a
 * one-character `keydown` key, become `x` repeated; longer keys (`Enter`, `Tab`) pass so a replay can still submit.
 */
export function fireOf(e: Event, el: EventTarget | null, secret: boolean): FireEvent | undefined {
  if (e.type === "keydown") {
    const key = e instanceof KeyboardEvent ? e.key : "";
    return { type: "keydown", key: secret && key.length === 1 ? "x" : key };
  }
  if (e.type !== "input") return PLAIN[e.type];
  const v = el === null ? "" : String(Reflect.get(el, "value") ?? "");
  return { type: "input", value: secret ? "x".repeat(v.length) : v };
}
