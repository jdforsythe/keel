/** `to` with search `next` appended, URL-encoded (k.guards). */
export function withNext(to: string, next: string): string {
  return `${to}${to.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}
