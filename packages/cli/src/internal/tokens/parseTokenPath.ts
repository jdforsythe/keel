import type { TokenPath } from "./TokenPath.ts";

/**
 * `<group>/<name>`, `<group>/<name>/<scheme>` (`light` or `dark`), or either after `themes/<theme>/`; undefined for
 * any other form, an empty segment included.
 */
export function parseTokenPath(path: string): TokenPath | undefined {
  const segments = path.split("/");
  if (segments.some((s) => s === "")) return undefined;
  const themed = segments[0] === "themes" && segments.length >= 4;
  const theme = themed ? segments[1] : undefined;
  const rest = themed ? segments.slice(2) : segments;
  const [group, name, scheme] = rest;
  if (group === undefined || name === undefined || rest.length > 3) return undefined;
  if (rest.length === 2) return { ...(theme === undefined ? {} : { theme }), group, name };
  if (scheme !== "light" && scheme !== "dark") return undefined;
  return { ...(theme === undefined ? {} : { theme }), group, name, scheme };
}
