import { unsafe } from "./unsafe.ts";

/** `p`, which on rejection first calls `note` and then rejects with the very error it rejected with. */
export function afterRejection<T>(p: Promise<T>, note: (x: unknown) => void): Promise<T> {
  return unsafe(
    "the flush loop tells a storage write that rejected from any other throw by noting the rejection, and rethrows the original error unchanged so its recovery decides, which attempt would replace with a keel.unexpected result",
    () =>
      p.catch((x: unknown) => {
        note(x);
        throw x;
      }),
  );
}
