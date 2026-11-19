import { s } from "@keel/schema";

/** The output of an API action that answers no data: an empty object. */
export const Nothing = s.object({});

export type Nothing = s.infer<typeof Nothing>;
