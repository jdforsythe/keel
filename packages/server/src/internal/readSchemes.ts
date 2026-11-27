import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Whether the app has both color schemes (k.schemes First paint): `<artifacts>/schemes.json` read once, `{ "schemes":
 * [...] }` (bare, or as an artifact's `data`) holding `light` and `dark`. No `artifacts`, no file, or any other content: one scheme.
 */
export async function readSchemes(artifacts: string | undefined): Promise<boolean> {
  if (artifacts === undefined) return false;
  const text = await readFile(join(artifacts, "schemes.json"), "utf8").catch(() => "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  // `.keel/schemes.json` holds it as an artifact's `data`; a build's `dist/<name>/schemes.json` holds it bare.
  const data: unknown =
    typeof parsed === "object" && parsed !== null ? (Reflect.get(parsed, "data") ?? parsed) : undefined;
  const list: unknown = typeof data === "object" && data !== null ? Reflect.get(data, "schemes") : undefined;
  return Array.isArray(list) && list.includes("light") && list.includes("dark");
}
