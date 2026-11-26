/**
 * The theme a document request asks for (k.schemes First paint): its `keel-theme` cookie when that is exactly one of
 * the app's `choice` themes, else undefined. The cookie holds a theme name and no identifier.
 */
export function themeOf(raw: Request, themes: readonly string[] | undefined): string | undefined {
  for (const part of (raw.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== "keel-theme") continue;
    const v = part.slice(eq + 1);
    return themes?.includes(v) === true ? v : undefined;
  }
  return undefined;
}
