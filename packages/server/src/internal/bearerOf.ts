import { type Secret, s } from "@keel/schema";

const BEARER = /^bearer +([A-Za-z0-9\-._~+/]{1,4096}=*)$/i;
const TOKEN = s.secret(s.string());
const ows = (c: string | undefined): boolean => c === " " || c === "\t";

/** `v` less HTTP optional whitespace at either end: spaces and horizontal tabs only, in linear time. */
function stripped(v: string): string {
  let a = 0;
  let b = v.length;
  while (a < b && ows(v[a])) a++;
  while (b > a && ows(v[b - 1])) b--;
  return v.slice(a, b);
}

/**
 * The request's `Authorization: Bearer` token as a `Secret` (k.api Bearer): the header's value (two headers read as one,
 * joined by `, `), less leading and trailing spaces and tabs, is `bearer` in any letter case, one or more spaces, then a token68 of 1 to 4,096 characters
 * and any trailing `=`. Anything else (another character around it, such as a no-break space), or no header, is `undefined`: no error and nothing logged.
 */
export function bearerOf(raw: Request): Secret<string> | undefined {
  const token = BEARER.exec(stripped(raw.headers.get("authorization") ?? ""))?.[1];
  if (token === undefined) return undefined;
  const parsed = TOKEN.parse(token);
  return parsed.ok ? parsed.value : undefined;
}
