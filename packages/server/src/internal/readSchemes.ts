import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Whether the app has both color schemes (k.schemes First paint): `<artifacts>/schemes.json` read once, `{ "schemes":
 * [...] }` holding `light` and `dark`. No `artifacts`, no file, or any other content: one scheme.
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
  const list: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "schemes") : undefined;
  return Array.isArray(list) && list.includes("light") && list.includes("dark");
}
