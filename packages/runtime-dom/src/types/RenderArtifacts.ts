/**
 * What a render is given beside its ctx (k.testing, k.a11y Artifacts): the project's evaluated `tokens`, or, where no
 * tokens are evaluated (a built client, a served document), the names of its `choice` themes (k.themes).
 */
export type RenderArtifacts = { readonly tokens?: unknown; readonly themes?: readonly string[] };
