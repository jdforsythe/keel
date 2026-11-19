import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";

const index = s.int({ min: -1, max: 9999 });
const count = s.int({ min: 0, max: 10_000 });

/**
 * The open state and active option of a list (std.options). `active` is an index, -1 for none, always below `count`
 * and -1 while `closed`; `back` says whether the last close returns focus. No key or text enters it.
 */
export const optionsChart = chart("headless.options", {
  data: s.object({ active: index, count, back: s.boolean() }),
  start: { active: -1, count: 0, back: false },
  events: {
    open: s.object({ count, at: index }),
    close: s.object({ back: s.boolean() }),
    choose: s.object({}),
    move: s.object({ by: s.enum(["next", "prev", "first", "last"]), wrap: s.boolean() }),
    jump: s.object({ to: index }),
    items: s.object({ count }),
  },
  actions: {
    open: (_, p) => ({ active: p.at < p.count ? p.at : -1, count: p.count, back: false }),
    close: (d, p) => ({ ...d, active: -1, back: p.back }),
    choose: (d) => ({ ...d, active: -1, back: true }),
    move: (d, p) => {
      const last = d.count - 1;
      const a = d.active;
      const to =
        p.by === "first"
          ? 0
          : p.by === "last"
            ? last
            : p.by === "next"
              ? a < 0
                ? 0
                : a < last
                  ? a + 1
                  : p.wrap
                    ? 0
                    : a
              : a < 0
                ? last
                : a > 0
                  ? a - 1
                  : p.wrap
                    ? last
                    : a;
      return { ...d, active: Math.min(to, last) };
    },
    jump: (d, p) => (p.to < d.count ? { ...d, active: p.to } : d),
    items: (d, p) => ({ ...d, count: p.count, active: Math.min(d.active, p.count - 1) }),
  },
  initial: "closed",
  states: {
    closed: { on: { open: { to: "open", do: "open" }, items: { do: "items" } } },
    open: {
      on: {
        close: { to: "closed", do: "close" },
        choose: { to: "closed", do: "choose" },
        move: { do: "move" },
        jump: { do: "jump" },
        items: { do: "items" },
      },
    },
  },
});
