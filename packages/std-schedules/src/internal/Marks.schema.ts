import { s } from "@keel/schema";

/** The fire marks `std.schedules.<module>` stores: the last fire time per schedule id, in epoch ms. */
export const Marks = s.record(s.number());
