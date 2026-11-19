/** The part of a k.store store a stream re-reads after a save: its id and `restore`. */
export interface Restorable {
  readonly id: string;
  restore(snapshot: unknown): { readonly ok: boolean };
}
