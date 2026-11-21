import { pathToFileURL } from "node:url";

/**
 * The file URL of user module `user` (std.multi `user`): a `file:` URL as is; a URL a dev server serves (a Vite test
 * environment hands a module such a URL for `new URL('./m.ts', import.meta.url)`) maps to its file, `/@fs/<path>` to
 * `<path>` and any other path to `<cwd>/<path>`; a bare path is a file path.
 */
export function moduleUrl(user: string, cwd: string): string {
  let url: URL;
  try {
    url = new URL(user);
  } catch {
    return pathToFileURL(user).href;
  }
  if (url.protocol === "file:") return url.href;
  const path = decodeURIComponent(url.pathname);
  return pathToFileURL(path.startsWith("/@fs/") ? path.slice(4) : `${cwd}${path}`).href;
}
