import { reveal, s } from "@keel/schema";

const SecretText = s.secret(s.string());

/** A presented token's text: the package's one `reveal`; `""` for a value that is not a `Secret` string, so it is no token. */
export function textOf(secret: unknown): string {
  // A plain string would parse into a new Secret: only a Secret the caller holds is a presented token.
  const parsed = typeof secret === "string" ? undefined : SecretText.parse(secret);
  return parsed?.ok === true ? reveal(parsed.value) : "";
}
