/** The tokens of a project's `tokens.ts`, or the reason it gives none (E1807, k.ui). */
export type TokensResult =
  | { readonly ok: true; readonly tokens: unknown }
  | { readonly ok: false; readonly reason: string };
