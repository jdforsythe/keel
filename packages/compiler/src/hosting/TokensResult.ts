/** The tokens of a project's `tokens.ts` and their color schemes (k.schemes), or the reason it gives none (E1807, k.ui). */
export type TokensResult =
  | { readonly ok: true; readonly tokens: unknown; readonly schemes: readonly string[] }
  | { readonly ok: false; readonly reason: string };
