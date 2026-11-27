/** What a held page looked like before its scripts ran, as `resume` compares it. */
export type HeldCheck = { readonly ok: true } | { readonly ok: false; readonly why: string };
