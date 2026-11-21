import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { Book } from "./Book.schema.ts";
import { Receipt } from "./Receipt.schema.ts";

/** The receipts book on the server: one store, restored from `ctx.storage` per request. */
export const bookStores = () => {
  const book = store(Book, { receipts: [] }, { id: "receipts.book" });
  invariant(book, (v) => v.receipts.length <= 200);
  const record = transaction(book, "receipts.record", s.object({ receipt: Receipt }), (state, p) =>
    state.receipts.length >= 200 ? state : { receipts: [p.receipt, ...state.receipts] },
  );
  return { book, record };
};
