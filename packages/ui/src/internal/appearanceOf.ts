import type { Ctx } from "@keel/ctx";
import { rendered } from "@keel/runtime-dom/internal";
import { appearanceState } from "./appearanceState.ts";
import { isRecord } from "./isRecord.ts";

/** The `choice` themes of evaluated tokens, in `themes` order (k.themes Themes). */
const choiceThemes = (tokens: unknown): string[] => {
  const themes = isRecord(tokens) ? tokens.themes : undefined;
  if (!isRecord(themes)) return [];
  return Object.entries(themes)
    .filter(([, t]) => isRecord(t) && (t.when === undefined || t.when === "choice"))
    .map(([n]) => n);
};

/** The document a ctx's picks act on, and the `choice` themes it knows (k.schemes Choice). */
export function appearanceOf(ctx: Ctx): {
  readonly document: Document | undefined;
  readonly themes: readonly string[];
  readonly version: { get(): number; set(v: number): void };
} {
  const state = appearanceState(ctx);
  const r = rendered.get(ctx);
  const global = !state.sim && "document" in globalThis ? globalThis.document : undefined;
  const document = r?.document ?? global;
  const themes = r === undefined ? [] : (r.artifacts.themes ?? choiceThemes(r.artifacts.tokens));
  return { document, themes, version: state.version };
}
