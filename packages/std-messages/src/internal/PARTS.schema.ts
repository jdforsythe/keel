import { s } from "@keel/schema";

/** The generator source of a message with params: the literal parts between its placeholders (std.messages). */
export const PARTS = s.array(s.string());
