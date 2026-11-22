import { manifest } from "@keel/router";
import { signedIn } from "../members/signedIn.guard.ts";
import BookPage from "./BookPage.tsx";
import ReceiptsShell from "./ReceiptsShell.tsx";
import { loadBook } from "./loadBook.server.ts";
import { loadShell } from "./loadShell.server.ts";
import { receipts } from "./receipts.contract.ts";
import { recordReceipt } from "./recordReceipt.server.ts";

export const routes = manifest(receipts, {
  "receipts.shell": { component: ReceiptsShell, loader: loadShell },
  "receipts.book": {
    component: BookPage,
    layout: "receipts.shell",
    loader: loadBook,
    guard: signedIn,
    POST: recordReceipt,
    title: (p) => p.data.text.heading,
  },
});
