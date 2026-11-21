import { s } from "@keel/schema";
import { Receipt } from "./Receipt.schema.ts";
import { ReceiptsText } from "./ReceiptsText.schema.ts";

export const BookData = s.object({ text: ReceiptsText, receipts: s.array(Receipt) });
