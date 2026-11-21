import { s } from "@keel/schema";

export const Item = s.object({
  id: s.id("Item"),
  name: s.string({ min: 1, max: 60 }),
  qty: s.int({ min: 1, max: 99 }),
  bought: s.boolean(),
});
