import { type KeelError, type Result, err } from "@keel/schema";

type Mismatch = KeelError<"credentials.mismatch", Record<string, never>>;

const error: Mismatch = Object.freeze({
  code: "credentials.mismatch",
  message: "credentials.mismatch",
  data: Object.freeze({}),
});

/** The one `credentials.mismatch` answer: no match, an unknown id, or a token that is not of the token form. */
export const MISMATCH: Result<never, Mismatch> = Object.freeze(err(error));
