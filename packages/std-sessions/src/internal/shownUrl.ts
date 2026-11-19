/** What a command may print of a target URL: its origin only (no user info, path, query or fragment). */
export function shownUrl(url: string): string {
  const origin = URL.canParse(url) ? new URL(url).origin : "null";
  return origin === "null" ? "(not an http(s) URL)" : origin;
}
