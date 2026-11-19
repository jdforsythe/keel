/**
 * The origin a shell build bakes in (k.shell Build 1): `KEEL_ORIGIN` when it is an `https:` URL, or `http:` or
 * `https:` on `localhost`; else undefined (E1574).
 */
export function shellOrigin(value: string | undefined): string | undefined {
  if (value === undefined || !URL.canParse(value)) return undefined;
  const u = new URL(value);
  const local = u.hostname === "localhost" && (u.protocol === "http:" || u.protocol === "https:");
  return u.protocol === "https:" || local ? u.origin : undefined;
}
