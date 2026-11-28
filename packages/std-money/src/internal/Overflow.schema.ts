import { s } from "@keel/schema";

/** `money.overflow` (std.money): an amount outside the bounds (1e15). */
export const Overflow = s.error("money.overflow", s.object({ amount: s.number() }));
