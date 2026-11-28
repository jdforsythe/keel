/**
 * The tokens of a project's `tokens.ts` and their color schemes (k.schemes), or the reason it gives none (E1807,
 * k.themes Token errors), with the issue path when `TokenSchema` refused them.
 */
export type TokensResult =
  | { readonly ok: true; readonly tokens: unknown; readonly schemes: readonly string[] }
  | { readonly ok: false; readonly reason: string; readonly path?: readonly string[] };
