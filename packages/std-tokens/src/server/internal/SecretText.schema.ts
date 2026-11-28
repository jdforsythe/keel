import { s } from "@keel/schema";

/** A presented token's text as the caller holds it: a `Secret` string (std.tokens). */
export const SecretText = s.secret(s.string());
