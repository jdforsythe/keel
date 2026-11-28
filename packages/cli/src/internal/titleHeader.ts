/** A header name as k.security writes it: `x-content-type-options` is `X-Content-Type-Options`. */
export function titleHeader(name: string): string {
  return name
    .split("-")
    .map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1)}`)
    .join("-");
}
