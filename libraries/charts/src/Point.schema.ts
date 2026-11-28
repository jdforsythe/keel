import { s } from "@keel/schema";

/**
 * One value of a chart. `name` says what it is (a week, a day), `value` places it, and `shown` is the value as a
 * person reads it, formatted by the app in its locale and unit (`12.40 €`, `85 ms`). The library draws `shown` and
 * lists it in the chart's table; it never formats a number itself. `value` is finite: NaN and Infinity fail here.
 */
export const Point = s.object({ name: s.string({ min: 1 }), value: s.number(), shown: s.string({ min: 1 }) });
