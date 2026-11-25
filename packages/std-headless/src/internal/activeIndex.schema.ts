import { s } from "@keel/schema";

/** An option index in a list chart, -1 for none. */
export const activeIndex = s.int({ min: -1, max: 9999 });
