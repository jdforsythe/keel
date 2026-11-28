/** A migration file (std.postgres Migrations): its number, kebab name, text and the SHA-256 of its text in hex. */
export type Migration = { readonly id: number; readonly name: string; readonly text: string; readonly digest: string };
