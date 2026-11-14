import { s } from "@keel/schema";
import { Currency, Money } from "@keel/std-money";
import { PlainDate } from "@keel/std-temporal";
import { line } from "@keel/std-text";

/** A recipe as the catalog table shows it: the recipe plus its price's currency, so the table can filter on it. */
export const CatalogRow = s.object({
  id: s.id("Recipe"),
  title: line({ max: 80 }),
  minutes: s.int({ min: 1, max: 600 }),
  favorite: s.boolean(),
  price: Money,
  addedOn: PlainDate,
  currency: Currency,
});

export type CatalogRow = s.infer<typeof CatalogRow>;
