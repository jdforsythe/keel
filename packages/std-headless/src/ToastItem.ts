/** A message a Toaster shows (std.headless): `status` is announced politely and expires, `alert` at once and stays. */
export type ToastItem = {
  readonly id: string;
  readonly text: string;
  readonly tone: "status" | "alert";
};
