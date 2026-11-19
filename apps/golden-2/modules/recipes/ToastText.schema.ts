import { s } from "@keel/schema";

/** A status toast's text, already in the page's locale. */
export const ToastText = s.object({ text: s.string({ min: 1 }) });

export type ToastText = s.infer<typeof ToastText>;
