import { s } from "@keel/schema";

/**
 * The words a chart shows, from the app's own copy: `numbers` names the button that shows the table of values, `name`
 * and `value` head its two columns.
 */
export const ChartText = s.object({
  numbers: s.string({ min: 1 }),
  name: s.string({ min: 1 }),
  value: s.string({ min: 1 }),
});
