import { s } from "@keel/schema";
import { Money } from "@keel/std-money";
import { PlainDate } from "@keel/std-temporal";
import { line } from "@keel/std-text";

export const Recipe = s.object({
  id: s.id("Recipe"),
  title: line({ max: 80 }),
  minutes: s.int({ min: 1, max: 600 }),
  favorite: s.boolean(),
  price: Money,
  addedOn: PlainDate,
});

export type Recipe = s.infer<typeof Recipe>;
