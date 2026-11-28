import { s } from "@keel/schema";

/** How long a formatted date or instant is (std.temporal): the `Intl.DateTimeFormat` `dateStyle` and `timeStyle`. */
export const DateStyle = s.enum(["short", "medium", "long", "full"]);
export type DateStyle = s.infer<typeof DateStyle>;
