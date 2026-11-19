/** The page's scheme and host, read from `location` when it is called; undefined without one. */
export function pageOf(): { readonly protocol: string; readonly host: string } | undefined {
  return typeof location === "undefined" ? undefined : { protocol: location.protocol, host: location.host };
}
