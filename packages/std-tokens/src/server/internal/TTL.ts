import { type KeelError, type Result, err } from "@keel/schema";

type Ttl = KeelError<"credentials.ttl", { readonly min: 60000; readonly max: 31536000000 }>;

const error: Ttl = Object.freeze({
  code: "credentials.ttl",
  message: "credentials.ttl",
  data: Object.freeze({ min: 60000, max: 31536000000 }),
});

/** The one `credentials.ttl` answer: a `ttl` that is not `null` and not an integer from 60,000 to 31,536,000,000. */
export const TTL: Result<never, Ttl> = Object.freeze(err(error));
