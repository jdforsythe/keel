/** An entry of a manifest's `env` (k.server-deps Environment): its string literal value, or null for any other form, at `start`. */
export type EnvEntry = { readonly value: string | null; readonly start: number };
