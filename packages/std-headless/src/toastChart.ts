import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";

const none = s.object({});

/**
 * One toast's life (std.headless): `showing` until it expires or is dismissed, `paused` while focus is inside it,
 * `gone` at the end.
 */
export const toastChart = chart("headless.toast", {
  data: none,
  start: {},
  events: { pause: none, resume: none, expire: none, dismiss: none },
  initial: "showing",
  states: {
    showing: { on: { pause: "paused", expire: "gone", dismiss: "gone" } },
    paused: { on: { resume: "showing", dismiss: "gone" } },
    gone: { final: true },
  },
});
