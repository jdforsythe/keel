import { s } from "@keel/schema";

/** How many receipts the book holds, as `select count(*)::int as n` answers it. */
export const ReceiptCount = s.object({ n: s.int({ min: 0 }) });
