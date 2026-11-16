import { type KeelError, type Result, err } from "@keel/schema";

type Length = KeelError<"credentials.length", { readonly min: 1; readonly max: 1024 }>;

const error: Length = Object.freeze({
  code: "credentials.length",
  message: "credentials.length",
  data: Object.freeze({ min: 1, max: 1024 }),
});

/** The one `credentials.length` answer: a secret that is empty or over 1,024 bytes. */
export const LENGTH: Result<never, Length> = Object.freeze(err(error));
