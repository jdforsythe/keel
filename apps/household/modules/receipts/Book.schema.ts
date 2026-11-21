import { s } from "@keel/schema";
import { Receipt } from "./Receipt.schema.ts";

export const Book = s.object({ receipts: s.array(Receipt) });
