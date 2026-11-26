/** One glossary term (k.docs Packed files): the term, its text and the section ids the text cites. */
export type DocsTerm = { readonly term: string; readonly text: string; readonly ids: readonly string[] };
