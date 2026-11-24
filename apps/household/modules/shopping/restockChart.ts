import { formatLiteral, s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { Instant } from "@keel/std-temporal";
import { PutBack } from "./PutBack.schema.ts";
import { RestockData } from "./RestockData.schema.ts";

/**
 * A weekly run: it puts one staple back (`putting`), rests two seconds (`resting`) and goes on with the next, until the
 * last is done. A staple whose step fails after its attempts ends the run in `failed`, with the code.
 */
export const restockChart = chart("shopping.restockChart", {
  data: RestockData,
  start: { staples: [], next: 0, putBack: 0, by: "member", at: formatLiteral(Instant, "1970-01-01T00:00:00.000Z"), code: "" },
  events: { put: PutBack, failed: s.object({ code: s.string({ max: 80 }) }), rested: s.object({}) },
  guards: { more: (d) => d.next + 1 < d.staples.length },
  actions: {
    count: (d, p) => ({ ...d, next: d.next + 1, putBack: d.putBack + ("putBack" in p && p.putBack ? 1 : 0) }),
    note: (d, p) => ({ ...d, code: "code" in p ? p.code : "" }),
  },
  initial: "putting",
  states: {
    putting: {
      on: {
        put: [
          { to: "resting", guard: "more", do: "count" },
          { to: "done", do: "count" },
        ],
        failed: { to: "failed", do: "note" },
      },
    },
    resting: { on: { rested: "putting" } },
    done: { final: true },
    failed: { final: true },
  },
});
