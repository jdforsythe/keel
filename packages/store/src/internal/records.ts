import { enrol, madeRecord } from "@keel/schema/internal";

enrol("@keel/store", import.meta.url);

/** What `@keel/store`'s makers made (k.identity): stores and transactions. A binding of this module only. */
export const records = Object.freeze({ store: madeRecord(), transaction: madeRecord() });
