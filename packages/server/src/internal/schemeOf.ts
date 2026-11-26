/**
 * The scheme a document request asks for (k.schemes First paint): its `keel-scheme` cookie when that is exactly
 * `light` or `dark`, else undefined. The cookie holds one of two words and no identifier.
 */
export function schemeOf(raw: Request): "light" | "dark" | undefined {
  for (const part of (raw.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== "keel-scheme") continue;
    const v = part.slice(eq + 1);
    return v === "light" || v === "dark" ? v : undefined;
  }
  return undefined;
}
