import { defect } from "@keel/schema";

/** `url` and its scheme, `pglite` or `pg`; a missing value or another scheme throws E2455, naming no part of it. */
export function schemeOf(url: string | undefined): { readonly url: string; readonly scheme: "pglite" | "pg" } {
  if (url === undefined || url === "")
    return defect("KEEL_POSTGRES_URL is not set; give it a postgres:, postgresql: or pglite: URL", { code: "E2455" });
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  if (scheme === "pglite") return { url, scheme: "pglite" };
  if (scheme === "postgres" || scheme === "postgresql") return { url, scheme: "pg" };
  return defect("KEEL_POSTGRES_URL is not a postgres:, postgresql: or pglite: URL", { code: "E2455" });
}
