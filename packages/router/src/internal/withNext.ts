/** `to` with search `next` appended, URL-encoded (k.router Guards). */
export function withNext(to: string, next: string): string {
  return `${to}${to.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}
