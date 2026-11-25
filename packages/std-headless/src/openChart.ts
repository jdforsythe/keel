import { chart } from "@keel/std-statecharts";
import { none } from "./internal/none.schema.ts";

/** The open or closed state of a Dialog or Disclosure (std.headless): `open`, `close` and `toggle`. */
export const openChart = chart("headless.open", {
  data: none,
  start: {},
  events: { open: none, close: none, toggle: none },
  initial: "closed",
  states: {
    closed: { on: { open: "open", toggle: "open" } },
    open: { on: { close: "closed", toggle: "closed" } },
  },
});
