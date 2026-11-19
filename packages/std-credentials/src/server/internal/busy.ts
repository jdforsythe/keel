import { type KeelError, type Result, err } from "@keel/schema";

type Busy = KeelError<"keel.busy", { readonly limit: number }>;

const answers = new Map<number, Result<never, Busy>>();

/** The one `keel.busy` answer for `limit`, the waiting bound that was full; nothing was derived for it. */
export function busy(limit: number): Result<never, Busy> {
  const known = answers.get(limit);
  if (known !== undefined) return known;
  const made: Result<never, Busy> = Object.freeze(
    err<Busy>(
      Object.freeze({
        code: "keel.busy",
        message: `more than ${limit} credential derivations waiting`,
        data: Object.freeze({ limit }),
      }),
    ),
  );
  answers.set(limit, made);
  return made;
}
