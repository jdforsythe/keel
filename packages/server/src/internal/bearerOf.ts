import { type Secret, s } from "@keel/schema";

const BEARER = /^bearer +([A-Za-z0-9\-._~+/]{1,4096}=*)$/i;
const TOKEN = s.secret(s.string());

/**
 * The request's `Authorization: Bearer` token as a `Secret` (k.api Bearer): the header's value (two headers read as one,
 * joined by `, `), trimmed, is `bearer` in any letter case, one or more spaces, then a token68 of 1 to 4,096 characters
 * and any trailing `=`. Anything else, or no header, is `undefined`: no error and nothing logged.
 */
export function bearerOf(raw: Request): Secret<string> | undefined {
  const token = BEARER.exec((raw.headers.get("authorization") ?? "").trim())?.[1];
  if (token === undefined) return undefined;
  const parsed = TOKEN.parse(token);
  return parsed.ok ? parsed.value : undefined;
}
