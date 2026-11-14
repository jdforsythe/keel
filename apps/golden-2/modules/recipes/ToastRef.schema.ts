import { s } from "@keel/schema";

/** A toast by id. */
export const ToastRef = s.object({ id: s.string({ min: 1, max: 64 }) });

export type ToastRef = s.infer<typeof ToastRef>;
