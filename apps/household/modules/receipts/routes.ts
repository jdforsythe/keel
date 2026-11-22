import { manifest } from "@keel/router";
import { signedIn } from "../members/signedIn.guard.ts";
import BookPage from "./BookPage.tsx";
import { loadBook } from "./loadBook.server.ts";
import { receipts } from "./receipts.contract.ts";
import { recordReceipt } from "./recordReceipt.server.ts";

export const routes = manifest(receipts, {
  "receipts.book": {
    component: BookPage,
    layout: "app.frame",
    loader: loadBook,
    guard: signedIn,
    POST: recordReceipt,
    title: (p) => p.data.text.heading,
  },
});
