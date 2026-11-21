import { manifest } from "@keel/router";
import BookPage from "./BookPage.tsx";
import { loadBook } from "./loadBook.server.ts";
import { receipts } from "./receipts.contract.ts";
import { recordReceipt } from "./recordReceipt.server.ts";

export const routes = manifest(receipts, {
  "receipts.book": {
    component: BookPage,
    loader: loadBook,
    POST: recordReceipt,
    title: (p) => p.data.text.heading,
  },
});
