import { s } from "@keel/schema";

/** One item of the list. `rev` counts its changes: a write sent through the outbox names the `rev` its writer read. */
export const Item = s.object({
  id: s.id("Item"),
  name: s.string({ min: 1, max: 60 }),
  qty: s.int({ min: 1, max: 99 }),
  bought: s.boolean(),
  rev: s.int({ min: 0 }),
});
