import type { Theme } from "@keel/ui";
import { TokenSchema } from "@keel/ui/tokens";
import type { Looks } from "./Looks.ts";
import { withWhen } from "./withWhen.ts";

/**
 * In a library's own folder, its shipped `themes.contrast` and `themes.print` as themes keyed `contrast` and `print`
 * with `when` set to the same (k.themes Library themes); undefined when the folder is no library, the shipped
 * object is out of form or fails `TokenSchema`, or it holds neither theme.
 */
export function ownThemes(looks: Looks): Readonly<Record<string, Theme>> | undefined {
  const shipped = looks.own?.shipped;
  if (shipped === null || shipped === undefined || shipped.problem !== null) return undefined;
  const parsed = TokenSchema.parse(withWhen(shipped.value));
  if (!parsed.ok) return undefined;
  const themes = parsed.value.themes;
  return themes === undefined || Object.keys(themes).length === 0 ? undefined : themes;
}
