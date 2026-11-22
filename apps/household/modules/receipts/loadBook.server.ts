import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { BookData } from "./BookData.schema.ts";
import { ReceiptsText } from "./ReceiptsText.schema.ts";
import { bookOf } from "./bookOf.server.ts";
import { receipts } from "./receipts.contract.ts";

export const loadBook = loader(receipts, "receipts.book", { output: BookData }, async ({ params }, ctx) => {
  const book = await bookOf(ctx);
  if (!book.ok) return err(book.error);
  return ok({ text: await ReceiptsText.load(params.locale), receipts: book.value });
});
