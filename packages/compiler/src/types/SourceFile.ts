/** One input module: a relative path (extension decides the parser language) and its text. */
export type SourceFile = { readonly path: string; readonly source: string };
