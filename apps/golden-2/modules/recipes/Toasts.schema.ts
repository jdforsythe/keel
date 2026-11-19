import { s } from "@keel/schema";

/** The toasts on screen and the number the next one takes in its id. */
export const Toasts = s.object({
  next: s.int({ min: 1 }),
  items: s.array(s.object({ id: s.string({ min: 1, max: 64 }), text: s.string(), tone: s.enum(["status", "alert"]) })),
});

export type Toasts = s.infer<typeof Toasts>;
