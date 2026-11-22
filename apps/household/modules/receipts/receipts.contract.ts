import { contract } from "@keel/router/contract";
import { BookParams } from "./BookParams.schema.ts";

export const receipts = contract("receipts", {
  "receipts.shell": { layout: true },
  "receipts.book": { path: "/:locale/receipts", params: BookParams },
});
