import { readFile } from "node:fs/promises";
import { join } from "node:path";

const THEME_NAME = /^[a-z][A-Za-z0-9]{0,23}$/;

/**
 * The app's schemes and `choice` themes (k.schemes First paint): `<artifacts>/schemes.json` read once, `{ "schemes":
 * [...], "themes": [...] }` (bare, or as an artifact's `data`); `both` when `schemes` holds `light` and `dark`, and
 * `themes` the entries shaped as theme names. No `artifacts`, no file, or any other content: one scheme, no themes.
 */
export async function readSchemes(
  artifacts: string | undefined,
): Promise<{ readonly both: boolean; readonly themes: readonly string[] }> {
  const none = { both: false, themes: [] };
  if (artifacts === undefined) return none;
  const text = await readFile(join(artifacts, "schemes.json"), "utf8").catch(() => "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return none;
  }
  // `.keel/schemes.json` holds it as an artifact's `data`; a build's `dist/<name>/schemes.json` holds it bare.
  const data: unknown =
    typeof parsed === "object" && parsed !== null ? (Reflect.get(parsed, "data") ?? parsed) : undefined;
  const field = (k: string): unknown => (typeof data === "object" && data !== null ? Reflect.get(data, k) : undefined);
  const list = field("schemes");
  const named = field("themes");
  const themes = Array.isArray(named)
    ? named.filter((t): t is string => typeof t === "string" && THEME_NAME.test(t))
    : [];
  return { both: Array.isArray(list) && list.includes("light") && list.includes("dark"), themes };
}
