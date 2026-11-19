import { type KeelError, type Result, err } from "@keel/schema";

type Expired = KeelError<"credentials.expired", Record<string, never>>;

const error: Expired = Object.freeze({
  code: "credentials.expired",
  message: "credentials.expired",
  data: Object.freeze({}),
});

/** The one `credentials.expired` answer: a matching token at or past the expiry in its digest. */
export const EXPIRED: Result<never, Expired> = Object.freeze(err(error));
