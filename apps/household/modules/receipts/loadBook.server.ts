import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { BookData } from "./BookData.schema.ts";
import { ReceiptsText } from "./ReceiptsText.schema.ts";
import { bookStores } from "./bookStores.ts";
import { receipts } from "./receipts.contract.ts";

export const loadBook = loader(
  receipts,
  "receipts.book",
  { output: BookData, stores: bookStores },
  async ({ params, stores }) =>
    ok({ text: await ReceiptsText.load(params.locale), receipts: stores.book.get("receipts") }),
);
