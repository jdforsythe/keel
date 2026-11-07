import { s } from "@keel/schema";

/** The input of an action that takes no fields. */
export const Nothing = s.object({});

export type Nothing = s.infer<typeof Nothing>;
