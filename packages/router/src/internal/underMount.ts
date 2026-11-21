import { attempt } from "@keel/schema";

/**
 * Whether `path` (no search or hash), its segments decoded as the matcher decodes them (`decodeURIComponent` each)
 * and joined by `/`, is `mount` or lies under it (k.mount-scope): `/%61pi/auth` and `/api%2Fauth` are under
 * `/api/auth`, `/API/auth` is not. An undecodable path is under none (it matches no page anyway).
 */
export function underMount(path: string, mount: string): boolean {
  const decoded = attempt(() => path.split("/").map(decodeURIComponent).join("/"));
  return decoded.ok && `${decoded.value.replace(/\/+$/, "")}/`.startsWith(`${mount}/`);
}
