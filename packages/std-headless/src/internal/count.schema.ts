import { s } from "@keel/schema";

/** The length of a list chart's list. */
export const count = s.int({ min: 0, max: 10_000 });
