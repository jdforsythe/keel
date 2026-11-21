import { fragment } from "@keel/std-postgres";

/** The select every recipe read shares, each row shaped as `Recipe`: the price as one `Money` object. */
export const recipeColumns = fragment`select id, title, minutes, favorite,
  json_build_object('amount', price_amount, 'currency', price_currency) as price, added_on::text as "addedOn" from recipes`;
