import { readValue } from "../../unsafe/readValue.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { ariaText } from "../internal/ariaText.ts";
import { bound } from "../internal/bound.ts";
import { isGetter } from "../internal/isGetter.ts";
import { isReadable } from "../internal/isReadable.ts";
import { make } from "../internal/make.ts";
import { put } from "../internal/put.ts";
import { runHost } from "../internal/runHost.ts";
import type { HostProps } from "../types/HostProps.ts";

/**
 * The host element (k.host-element): the one element whose node outside code owns. Renders an empty `div` with
 * `data-k-host`, `data-k`, its `role`, its text alternative and its style props, and hands the element, its value
 * reader and its `code` to the runtime's lifecycle; `code` is never called while rendering.
 */
export function Host<I, E = never>(props: HostProps<I, E>): Node {
  const p: Readonly<Record<string, unknown>> = props;
  return make("div", (el) => {
    el.setAttribute("data-k-host", "");
    bound(el);
    applyIdLang(el, props);
    el.setAttribute("role", props.role);
    put(el, p, "label", "aria-label", ariaText);
    put(el, p, "labelledBy", "aria-labelledby", ariaText);
    put(el, p, "describedBy", "aria-describedby", ariaText);
    applyStyle(el, p);
    const value = (): I => readValue(props.value);
    runHost(el, {
      id: props.id,
      input: props.input,
      value,
      live: isGetter(props, "value") || isReadable(props.value),
      code: props.code,
      events: props.events,
      onEvent: props.onEvent,
    });
  });
}
