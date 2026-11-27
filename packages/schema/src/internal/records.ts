import { census } from "./census.ts";
import { codedRefusal } from "./codedRefusal.ts";
import { madeRecord } from "./madeRecord.ts";

/**
 * What `@keel/schema`'s makers made (k.identity): schemas, object schemas, defects, secrets and coded refusals. A
 * binding of this module only; no entry exports it or a function that adds to it.
 */
export const records = Object.freeze({
  schema: madeRecord(),
  objectSchema: madeRecord(),
  defect: madeRecord(),
  secret: madeRecord(),
  refusal: madeRecord(),
});

const first = census("@keel/schema", import.meta.url);
if (first !== undefined)
  throw codedRefusal(
    records.refusal,
    "E1765",
    `two copies of @keel/schema in one realm: ${first} and ${import.meta.url.replace(/[?#].*$/, "")}`,
    "k.realm",
  );
